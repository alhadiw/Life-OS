import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

/**
 * ARCH-3 — a real data layer.
 *
 * Before this, every page owned a `fetchX()` inside a `useEffect`, refetched on
 * mount and on every tab change, and knew nothing about any other page. Toggling
 * a task on /tasks left the Dashboard's copy of that task stale until you
 * navigated away and back. There were ~15 of these blocks and they all
 * reimplemented loading/error handling slightly differently.
 *
 * This is deliberately NOT TanStack Query. CLAUDE.md's rule is that there are no
 * runtime dependencies beyond the five the app already has, and the subset we
 * actually need — dedupe, cache, invalidate, share between components — is about
 * a hundred lines. Adding a 13 kB dependency to use a tenth of it is a worse
 * trade for an app whose entire point is loading fast on a phone.
 *
 * The cache is module-level and deliberately NOT persisted. Every row is
 * RLS-scoped to the signed-in user, and a cache that outlived a session would
 * reintroduce exactly the cross-account leak that keeps Supabase out of the
 * service worker's runtimeCaching. `clearQueryCache()` runs on sign-out.
 */

const DEFAULT_STALE_MS = 30_000;

interface Entry<T> {
    data?: T;
    error?: unknown;
    /** 0 means "never successfully loaded". */
    fetchedAt: number;
    loading: boolean;
}

const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<void>>();
const listeners = new Map<string, Set<() => void>>();

/** Shared reference for keys with no entry yet — useSyncExternalStore requires
 *  a stable snapshot, and returning a fresh object each call loops forever. */
const PENDING: Entry<unknown> = Object.freeze({ fetchedAt: 0, loading: true });

const emit = (key: string) => {
    const set = listeners.get(key);
    if (set) for (const l of set) l();
};

const subscribe = (key: string, onChange: () => void) => {
    let set = listeners.get(key);
    if (!set) {
        set = new Set();
        listeners.set(key, set);
    }
    set.add(onChange);
    return () => {
        set.delete(onChange);
        if (set.size === 0) listeners.delete(key);
    };
};

const write = <T,>(key: string, entry: Entry<T>) => {
    cache.set(key, entry as Entry<unknown>);
    emit(key);
};

/**
 * Drop everything under `prefix`, then let any mounted hook refetch.
 *
 * Keys are colon-segmented (`'tasks'`, `'habits:completions:2026-08'`), so
 * `invalidate('habits')` clears every habit-derived query without callers having
 * to enumerate them. This is what makes a write on one page correct the data on
 * another.
 */
export const invalidate = (prefix: string) => {
    for (const key of [...cache.keys()]) {
        if (key === prefix || key.startsWith(`${prefix}:`)) {
            cache.delete(key);
            inflight.delete(key);
            emit(key);
        }
    }
};

/** Sign-out. See the note about RLS scoping above — this is not optional. */
export const clearQueryCache = () => {
    const keys = [...cache.keys()];
    cache.clear();
    inflight.clear();
    for (const key of keys) emit(key);
};

/**
 * Patch a cached value in place without a round trip.
 *
 * Used for optimistic updates. The caller is responsible for reverting on
 * failure — same contract as PointsContext.commit(), and for the same reason:
 * an optimistic update that silently survives a failed write is a lie.
 */
export const setQueryData = <T,>(key: string, update: (prev: T | undefined) => T) => {
    const prev = cache.get(key) as Entry<T> | undefined;
    write<T>(key, {
        data: update(prev?.data),
        fetchedAt: prev?.fetchedAt ?? Date.now(),
        loading: false
    });
};

export const getQueryData = <T,>(key: string): T | undefined =>
    (cache.get(key) as Entry<T> | undefined)?.data;

const run = <T,>(key: string, fetcher: () => Promise<T>): Promise<void> => {
    const existing = inflight.get(key);
    if (existing) return existing;

    const prev = cache.get(key) as Entry<T> | undefined;
    write<T>(key, { ...prev, data: prev?.data, fetchedAt: prev?.fetchedAt ?? 0, loading: true });

    const promise = fetcher()
        .then(data => {
            write<T>(key, { data, fetchedAt: Date.now(), loading: false });
        })
        .catch(error => {
            // Keep any previously good data visible rather than blanking the
            // screen on a transient failure; the caller decides how loudly to
            // report `error`.
            const stale = cache.get(key) as Entry<T> | undefined;
            write<T>(key, { data: stale?.data, error, fetchedAt: stale?.fetchedAt ?? 0, loading: false });
        })
        .finally(() => {
            inflight.delete(key);
        });

    inflight.set(key, promise);
    return promise;
};

export interface QueryResult<T> {
    data: T | undefined;
    loading: boolean;
    error: unknown;
    refetch: () => Promise<void>;
}

/**
 * @param key      Cache key, or null to disable the query (e.g. no user yet).
 * @param fetcher  Must reject on failure. Supabase resolves with an `error`
 *                 property instead of throwing, so callers pass a wrapper that
 *                 turns that into a rejection — see `fromSupabase` below.
 */
export function useQuery<T>(
    key: string | null,
    fetcher: () => Promise<T>,
    options?: { staleMs?: number }
): QueryResult<T> {
    const staleMs = options?.staleMs ?? DEFAULT_STALE_MS;

    // The fetcher is almost always an inline arrow, so its identity changes
    // every render. Holding it in a ref keeps the effect below keyed on `key`
    // alone instead of refetching in a loop.
    //
    // The assignment lives in an effect rather than in the render body: writing
    // to a ref during render is a side effect, and `react-hooks` rejects it.
    // This effect is declared before the fetching one, and effects run in
    // declaration order, so the ref is always current by the time a fetch fires.
    const fetcherRef = useRef(fetcher);
    useEffect(() => {
        fetcherRef.current = fetcher;
    });

    const entry = useSyncExternalStore(
        useCallback((cb: () => void) => (key ? subscribe(key, cb) : () => {}), [key]),
        useCallback(() => (key ? cache.get(key) ?? PENDING : PENDING) as Entry<T>, [key])
    );

    useEffect(() => {
        if (!key) return;
        const current = cache.get(key) as Entry<T> | undefined;
        const fresh = current && current.fetchedAt > 0 && Date.now() - current.fetchedAt < staleMs;
        if (fresh || inflight.has(key)) return;
        void run<T>(key, () => fetcherRef.current());
    }, [key, staleMs, entry]);

    const refetch = useCallback(async () => {
        if (!key) return;
        inflight.delete(key);
        await run<T>(key, () => fetcherRef.current());
    }, [key]);

    return {
        data: entry.data,
        // A key that has never loaded reads as loading, so pages can show a
        // skeleton on first paint without tracking that separately.
        loading: entry.loading && entry.fetchedAt === 0,
        error: entry.error,
        refetch
    };
}

/**
 * Adapt a supabase-js call to promise semantics.
 *
 * supabase-js RESOLVES with `{ data, error }` rather than rejecting, which is
 * the exact bug Phase 2 found in Exercise.completeGoal — a try/catch around it
 * can never fire. Every fetcher goes through here so a failed read is a rejected
 * promise like any other.
 */
export async function fromSupabase<T>(
    query: PromiseLike<{ data: T | null; error: { message: string } | null }>
): Promise<T> {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T;
}
