import { addDays, daysBetween, parseISODate, startOfWeekISO, todayISO } from './dates';
import type { Tables } from './supabase';

/**
 * Habit scheduling (HAB-2), streaks (HAB-3) and freezes (HAB-6).
 *
 * Everything here is a pure function over `'yyyy-MM-dd'` strings, deliberately
 * kept out of the components: streak arithmetic is the part most likely to be
 * quietly wrong, and it is far easier to reason about in one place than spread
 * across a page that is also doing data fetching.
 *
 * All dates are the user's local dates (src/lib/dates.ts), never UTC — FIX-6.
 */

export type Habit = Tables<'habits'>;

/** 0 = Sunday … 6 = Saturday, matching JS `Date.getDay()` and the DB check. */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const weekdayOf = (iso: string): number => parseISODate(iso).getDay();

/**
 * Is this habit expected on this date?
 *
 * `times_per_week` deliberately returns true for every day: an "N times a week"
 * habit is never due on a *particular* day, so any day is a legitimate day to do
 * it. Whether the week's target has been met is a separate question, answered by
 * `weeklyProgress`.
 */
export const isDueOn = (habit: Habit, iso: string): boolean => {
    if (habit.archived) return false;
    // Nothing is due before the habit existed, otherwise every habit is created
    // with a history of failures stretching back to the beginning of the heatmap.
    if (iso < habit.start_date) return false;

    switch (habit.schedule_kind) {
        case 'daily':
            return true;
        case 'weekdays':
            return (habit.schedule_weekdays ?? []).includes(weekdayOf(iso));
        case 'times_per_week':
            return true;
        case 'every_n_days': {
            const n = habit.schedule_interval_days ?? 1;
            if (n <= 1) return true;
            return daysBetween(habit.start_date, iso) % n === 0;
        }
        default:
            return true;
    }
};

/** Completions for one habit, as a set of ISO dates, for O(1) lookups. */
export const completionSet = (dates: string[]): Set<string> => new Set(dates);

export interface WeeklyProgress {
    done: number;
    target: number;
}

/** For `times_per_week` habits: how many completions this Monday-start week. */
export const weeklyProgress = (
    habit: Habit,
    completed: Set<string>,
    onISO: string = todayISO()
): WeeklyProgress | null => {
    if (habit.schedule_kind !== 'times_per_week') return null;
    const start = startOfWeekISO(onISO);
    let done = 0;
    for (let i = 0; i < 7; i++) {
        if (completed.has(addDays(start, i))) done++;
    }
    return { done, target: habit.schedule_times_per_week ?? 1 };
};

export interface StreakResult {
    current: number;
    longest: number;
}

/**
 * Current and longest streak, counted in *scheduled occasions*, not days.
 *
 * A Mon/Wed/Fri habit done three weeks running is a streak of 9, not 21 — days
 * it was never due must not count as either successes or misses, or every
 * non-daily habit would read as permanently broken.
 *
 * Freezes (HAB-6) absorb a miss: the chain survives, but the frozen day is not
 * itself a success, so it neither adds to nor resets the count.
 *
 * Today is special-cased. A daily habit you have not done *yet* today is not a
 * broken streak at 9am — the day is still open. So the walk starts at the most
 * recent due date that is either completed or in the past.
 */
export const computeStreak = (
    habit: Habit,
    completed: Set<string>,
    frozen: Set<string>,
    todayISOValue: string = todayISO()
): StreakResult => {
    // `times_per_week` has no per-day expectation, so a day-by-day chain is
    // meaningless. Count consecutive weeks that hit their target instead.
    if (habit.schedule_kind === 'times_per_week') {
        return weeklyStreak(habit, completed, frozen, todayISOValue);
    }

    let current = 0;
    let longest = 0;
    let run = 0;

    // Walk backwards from today to the habit's start date. The dataset is one
    // user's own history, so this is bounded by how long they have used the app.
    const totalDays = Math.max(0, daysBetween(habit.start_date, todayISOValue));
    let currentStillLive = true;

    for (let offset = 0; offset <= totalDays; offset++) {
        const iso = addDays(todayISOValue, -offset);
        if (!isDueOn(habit, iso)) continue;

        if (completed.has(iso)) {
            run++;
            if (run > longest) longest = run;
            if (currentStillLive) current = run;
        } else if (frozen.has(iso)) {
            // Frozen: the chain continues but the day scores nothing.
            continue;
        } else if (iso === todayISOValue) {
            // Today is still open — not a miss yet, and not a success.
            continue;
        } else {
            // A real miss ends the current streak, but we keep walking to find
            // the longest one historically.
            currentStillLive = false;
            run = 0;
        }
    }

    return { current, longest };
};

/**
 * Consecutive weeks meeting the target, for `times_per_week` habits.
 *
 * Freezes count toward the week's target. They used to be ignored entirely —
 * `frozen` was never even passed in — so freezing a day on an N-times-per-week
 * habit spent budget from the monthly allowance and had no effect on the streak
 * whatsoever. A freeze is a day you deliberately bought out of, so it should
 * carry the same weight here as it does on a daily habit, where it stops the
 * chain from breaking.
 */
const weeklyStreak = (
    habit: Habit,
    completed: Set<string>,
    frozen: Set<string>,
    todayISOValue: string
): StreakResult => {
    const target = habit.schedule_times_per_week ?? 1;
    let current = 0;
    let longest = 0;
    let run = 0;
    let currentStillLive = true;

    const firstWeek = startOfWeekISO(habit.start_date);
    let week = startOfWeekISO(todayISOValue);
    const thisWeek = week;

    while (week >= firstWeek) {
        let done = 0;
        let excused = 0;
        for (let i = 0; i < 7; i++) {
            const day = addDays(week, i);
            if (completed.has(day)) done++;
            else if (frozen.has(day)) excused++;
        }

        if (done + excused >= target) {
            run++;
            if (run > longest) longest = run;
            if (currentStillLive) current = run;
        } else if (week === thisWeek) {
            // The current week is still in progress — not a failure yet.
        } else {
            currentStillLive = false;
            run = 0;
        }

        week = addDays(week, -7);
    }

    return { current, longest };
};

/** Freezes used in the calendar month containing `iso` (HAB-6 budget). */
export const freezesUsedInMonth = (frozen: Set<string>, iso: string = todayISO()): number => {
    const prefix = iso.slice(0, 7);
    let used = 0;
    for (const d of frozen) if (d.startsWith(prefix)) used++;
    return used;
};

/**
 * Completion rate over the last `days` scheduled occasions.
 * Frozen days are excluded from both numerator and denominator — a freeze is
 * "this day doesn't count", and counting it as a failure would defeat the point.
 */
export const completionRate = (
    habit: Habit,
    completed: Set<string>,
    frozen: Set<string>,
    days: number,
    todayISOValue: string = todayISO()
): number | null => {
    let due = 0;
    let done = 0;
    for (let offset = 0; offset < days; offset++) {
        const iso = addDays(todayISOValue, -offset);
        if (iso < habit.start_date || !isDueOn(habit, iso)) continue;
        if (frozen.has(iso)) continue;
        due++;
        if (completed.has(iso)) done++;
    }
    return due === 0 ? null : Math.round((done / due) * 100);
};
