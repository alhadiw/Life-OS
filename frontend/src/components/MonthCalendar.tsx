import React, { useMemo, useState } from 'react';
import { addDays, parseISODate, startOfMonthISO, todayISO } from '../lib/dates';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './MonthCalendar.css';

/**
 * A single month, for the expanded per-habit view.
 *
 * When you open one habit, "how am I doing this month" is the question — not
 * "show me 53 weeks". A 7-column grid gives cells roughly four times the area of
 * a heatmap square, which is the difference between readable and not on a phone,
 * and weekday alignment comes free, so a Mon/Wed/Fri habit visibly lines up in
 * columns instead of looking like scattered noise.
 */

export interface MonthCalendarProps {
    completed: Set<string>;
    frozen?: Set<string>;
    /** Days the habit was scheduled. Anything absent renders as a rest day. */
    isDue: (iso: string) => boolean;
    color?: string;
}

const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export const MonthCalendar: React.FC<MonthCalendarProps> = ({
    completed,
    frozen,
    isDue,
    color = 'var(--primary-color)'
}) => {
    const today = todayISO();
    const [monthStart, setMonthStart] = useState(() => startOfMonthISO(today));

    const { cells, label } = useMemo(() => {
        const firstWeekday = parseISODate(monthStart).getDay();
        const gridStart = addDays(monthStart, -firstWeekday);
        const monthPrefix = monthStart.slice(0, 7);

        const out: {
            iso: string;
            inMonth: boolean;
            day: number;
            state: 'done' | 'frozen' | 'missed' | 'rest' | 'future';
        }[] = [];

        // Six rows always, so the grid does not jump height between months.
        for (let i = 0; i < 42; i++) {
            const iso = addDays(gridStart, i);
            const inMonth = iso.startsWith(monthPrefix);
            const state =
                completed.has(iso) ? 'done'
                    : frozen?.has(iso) ? 'frozen'
                        : iso > today ? 'future'
                            : !isDue(iso) ? 'rest'
                                : 'missed';
            out.push({ iso, inMonth, day: Number(iso.slice(8, 10)), state });
        }

        const m = Number(monthStart.slice(5, 7)) - 1;
        return { cells: out, label: `${MONTH_NAMES[m]} ${monthStart.slice(0, 4)}` };
    }, [monthStart, completed, frozen, isDue, today]);

    const shiftMonth = (delta: number) => {
        // Step via the 1st of the month so no day-of-month arithmetic can land
        // on a date that doesn't exist (the 31st of February problem).
        const base = parseISODate(monthStart);
        const next = new Date(base.getFullYear(), base.getMonth() + delta, 1);
        const iso = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
        setMonthStart(iso);
    };

    const doneThisMonth = cells.filter(c => c.inMonth && c.state === 'done').length;
    const atCurrentMonth = monthStart >= startOfMonthISO(today);

    return (
        <div className="month-cal" style={{ ['--month-color' as string]: color }}>
            <div className="month-cal-head">
                <button className="icon-btn" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <ChevronLeft size={16} />
                </button>
                <div className="month-cal-title">
                    <strong>{label}</strong>
                    <span className="text-muted">{doneThisMonth} done</span>
                </div>
                <button
                    className="icon-btn"
                    onClick={() => shiftMonth(1)}
                    disabled={atCurrentMonth}
                    aria-label="Next month"
                >
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="month-cal-grid" role="grid" aria-label={label}>
                {WEEKDAY_INITIALS.map((d, i) => (
                    <span key={i} className="month-cal-weekday" aria-hidden="true">{d}</span>
                ))}
                {cells.map(c => (
                    <span
                        key={c.iso}
                        className={[
                            'month-cal-day',
                            `state-${c.state}`,
                            c.inMonth ? '' : 'outside',
                            c.iso === today ? 'is-today' : ''
                        ].filter(Boolean).join(' ')}
                        title={`${c.iso} — ${describe(c.state)}`}
                    >
                        {c.day}
                    </span>
                ))}
            </div>
        </div>
    );
};

const describe = (state: string): string =>
    state === 'done' ? 'completed'
        : state === 'frozen' ? 'frozen — streak protected'
            : state === 'rest' ? 'not scheduled'
                : state === 'future' ? 'upcoming'
                    : 'missed';
