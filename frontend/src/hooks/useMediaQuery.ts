import { useCallback, useSyncExternalStore } from 'react';

/**
 * Subscribe to a CSS media query from JavaScript.
 *
 * Needed where a layout decision cannot be expressed in CSS alone — the heatmap
 * chooses how many *columns to build*, which is a render-time decision, not a
 * style.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: matchMedia is an
 * external store, and the state version would mean calling setState from an
 * effect, which `react-hooks` rejects (and which caused FIX-10).
 */
export const useMediaQuery = (query: string): boolean => {
    const subscribe = useCallback((onChange: () => void) => {
        const mql = window.matchMedia(query);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        // No window (never happens in this SPA, but the signature demands it).
        () => false
    );
};
