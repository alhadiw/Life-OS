/**
 * Calendar-day helpers (FIX-6).
 *
 * The app used to mix two incompatible notions of "today": date-fns `format()`,
 * which is local, and `new Date().toISOString().split('T')[0]`, which is UTC.
 * Those two disagree for part of every day in every zone that isn't UTC, so a
 * workout logged at 9pm could be filed under tomorrow, and a bill due today
 * could fall outside a "due this week" window.
 *
 * Everything date-only in this app (`due_date`, `exercise_date`, `target_date`)
 * is a Postgres `date` and should be interpreted in the *user's* calendar. This
 * module is the single place that decides what day it is.
 *
 * ISO date strings ('yyyy-MM-dd') are the currency here rather than `Date`
 * objects: they are what the database stores, they compare correctly with `<`
 * and `===`, and they carry no time or zone to be misinterpreted.
 */

/**
 * The active user's IANA zone, set once when their profile loads.
 *
 * Module-level rather than React state on purpose. Every date decision in the
 * app needs it, it changes at most once per session, and threading it through
 * as an argument would mean touching every call site for a value that is
 * effectively a session constant.
 */
let userTimezone: string | null = null;

/** The zone the browser thinks it's in. The fallback, and the initial guess. */
export const browserTimezone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
        return 'UTC';
    }
};

export const setUserTimezone = (tz: string | null | undefined) => {
    userTimezone = tz || null;
};

export const getUserTimezone = (): string => userTimezone || browserTimezone();

/** 'en-CA' is the one common locale whose short date format is exactly yyyy-MM-dd. */
const isoFormatter = (timeZone: string) =>
    new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

/** The calendar date of `instant` as seen in the user's timezone. */
export const toISODate = (instant: Date = new Date()): string =>
    isoFormatter(getUserTimezone()).format(instant);

/** Today, in the user's timezone. */
export const todayISO = (): string => toISODate(new Date());

/**
 * Anchor an ISO date at UTC midnight so day arithmetic can't be shifted by a
 * DST transition. Only ever used with the helpers below, never for display.
 */
const anchor = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

const unanchor = (d: Date): string => d.toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => {
    const d = anchor(iso);
    d.setUTCDate(d.getUTCDate() + days);
    return unanchor(d);
};

/** Difference in whole calendar days: `daysBetween('2026-07-27', '2026-07-29') === 2`. */
export const daysBetween = (fromISO: string, toISO: string): number =>
    Math.round((anchor(toISO).getTime() - anchor(fromISO).getTime()) / 86_400_000);

/**
 * Start of the week containing `iso`.
 *
 * `weekStartsOn` is 0 for Sunday, 1 for Monday. Monday is the default because
 * that is what the app has always assumed; it becomes a per-user setting in
 * CUST-5.
 */
export const startOfWeekISO = (iso: string = todayISO(), weekStartsOn: 0 | 1 = 1): string => {
    const day = anchor(iso).getUTCDay();
    return addDays(iso, -((day - weekStartsOn + 7) % 7));
};

/** First day of the month containing `iso`. */
export const startOfMonthISO = (iso: string = todayISO()): string => `${iso.slice(0, 7)}-01`;

/** Last day of the month containing `iso`. */
export const endOfMonthISO = (iso: string = todayISO()): string => {
    const [year, month] = iso.split('-').map(Number);
    // Day 0 of the following month is the last day of this one.
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${iso.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`;
};

/**
 * Parse an ISO date for *display* only.
 *
 * Anchored at local noon rather than midnight so that `toLocaleDateString` and
 * date-fns `format` can never render the previous day, which is what
 * `new Date('2026-07-27')` does west of Greenwich (it parses as UTC midnight).
 */
export const parseISODate = (iso: string): Date => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
};
