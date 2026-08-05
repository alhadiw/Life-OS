import React, { useMemo } from 'react';
import { addDays, parseISODate, todayISO } from '../lib/dates';
import { useMediaQuery } from '../hooks/useMediaQuery';
import './Heatmap.css';

/**
 * HAB-4 — contribution-style heatmap.
 *
 * This is the payoff for ARCH-1: it is only drawable because completion rows
 * survive instead of being cleared nightly.
 *
 * Two things it now does that the first version did not.
 *
 * **It shrinks the window, not the cells.** A full year is 53 columns. At the old
 * 10px mobile cell that is ~634px of grid against roughly 320px of usable width
 * on a phone, so you saw under half of it and scrolled for the rest. Fewer weeks
 * at a legible size beats more weeks you cannot read.
 *
 * **It distinguishes why a square is empty.** Previously "missed", "not
 * scheduled" and "frozen" all rendered identically, so a Mon–Fri habit's
 * weekends looked like failures and a freeze you deliberately spent looked like
 * giving up. That made the map quietly dishonest, which is worse than small.
 */

export interface HeatmapProps {
    /** ISO date -> intensity. Absent or 0 means nothing was completed. */
    values: Map<string, number>;
    /** Days the habit was never scheduled. Rendered faint, not as a miss. */
    notDue?: Set<string>;
    /** Days bought out with a streak freeze (HAB-6). */
    frozen?: Set<string>;
    /** Window on a wide screen. 371 = 53 whole weeks. */
    days?: number;
    /** Window under 640px. Defaults to a quarter, which fits without scrolling. */
    compactDays?: number;
    /** Highest value that still maps to a shade; above this everything is level 4. */
    max?: number;
    endISO?: string;
    title?: string;
    colorVar?: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type DayState = 'done' | 'missed' | 'notDue' | 'frozen';

interface Cell {
    iso: string;
    level: number;
    value: number;
    state: DayState;
}

export const Heatmap: React.FC<HeatmapProps> = ({
    values,
    notDue,
    frozen,
    days = 371,
    compactDays = 119,
    max = 1,
    endISO = todayISO(),
    title,
    colorVar = '--success-color'
}) => {
    const compact = useMediaQuery('(max-width: 640px)');
    const window = compact ? compactDays : days;

    const { cells, monthMarks, weeks } = useMemo(() => {
        // End on the Saturday of the current week so the final column is whole
        // and today is never orphaned in a half-drawn week.
        const endWeekday = parseISODate(endISO).getDay();
        const gridEnd = addDays(endISO, 6 - endWeekday);
        const gridStart = addDays(gridEnd, -(window - 1));
        // Align the start to a Sunday so row 0 is always Sunday.
        const startWeekday = parseISODate(gridStart).getDay();
        const alignedStart = addDays(gridStart, -startWeekday);

        const out: Cell[] = [];
        const marks: { col: number; label: string }[] = [];
        let cursor = alignedStart;
        let col = 0;
        let lastMonth = '';

        while (cursor <= gridEnd) {
            for (let row = 0; row < 7; row++) {
                const iso = addDays(cursor, row);
                const value = values.get(iso) ?? 0;
                // Five levels: 0 plus four shades, matching the CSS.
                const level = value <= 0 ? 0 : Math.min(4, Math.ceil((value / Math.max(1, max)) * 4));

                // Order matters: a frozen day reads as frozen even if it was also
                // outside the schedule, and a completed day always reads as done.
                const state: DayState =
                    level > 0 ? 'done'
                        : frozen?.has(iso) ? 'frozen'
                            : notDue?.has(iso) ? 'notDue'
                                : iso > endISO ? 'notDue'   // the rest of this week
                                    : 'missed';

                out.push({ iso, level, value, state });
            }
            const month = cursor.slice(0, 7);
            if (month !== lastMonth) {
                // Only label a column if the month actually starts near it,
                // otherwise the first partial week mislabels the whole strip.
                const dayOfMonth = Number(cursor.slice(8, 10));
                if (dayOfMonth <= 7) {
                    marks.push({ col, label: MONTH_LABELS[Number(month.slice(5, 7)) - 1] });
                }
                lastMonth = month;
            }
            cursor = addDays(cursor, 7);
            col++;
        }

        return { cells: out, monthMarks: marks, weeks: col };
    }, [values, notDue, frozen, window, max, endISO]);

    const total = useMemo(() => cells.filter(c => c.value > 0).length, [cells]);
    const weeksShown = Math.round(window / 7);

    return (
        <div className="heatmap">
            {title && (
                <div className="heatmap-head">
                    <span className="heatmap-title">{title}</span>
                    <span className="heatmap-count">
                        {total} {total === 1 ? 'day' : 'days'} · {weeksShown}w
                    </span>
                </div>
            )}

            {/* The grid can still exceed the viewport at the widest window, so it
                scrolls inside its own box and the page body never scrolls. */}
            <div className="heatmap-scroll">
                <div className="heatmap-inner" style={{ ['--heatmap-color' as string]: `var(${colorVar})` }}>
                    <div className="heatmap-months" style={{ gridTemplateColumns: `repeat(${weeks}, var(--heatmap-cell))` }}>
                        {monthMarks.map(m => (
                            <span key={`${m.col}-${m.label}`} style={{ gridColumnStart: m.col + 1 }}>
                                {m.label}
                            </span>
                        ))}
                    </div>

                    <div
                        className="heatmap-grid"
                        style={{ gridTemplateColumns: `repeat(${weeks}, var(--heatmap-cell))` }}
                        role="img"
                        aria-label={
                            `${title ? `${title}: ` : ''}${total} days completed in the last ${weeksShown} weeks`
                        }
                    >
                        {cells.map(c => (
                            <span
                                key={c.iso}
                                className={`heatmap-cell level-${c.level} state-${c.state}`}
                                title={`${c.iso} — ${describe(c)}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="heatmap-legend">
                {(notDue || frozen) && (
                    <div className="heatmap-key">
                        {frozen && <span><i className="heatmap-cell state-frozen" /> frozen</span>}
                        {notDue && <span><i className="heatmap-cell state-notDue" /> not due</span>}
                        <span><i className="heatmap-cell state-missed" /> missed</span>
                    </div>
                )}
                <div className="heatmap-scale">
                    <span>Less</span>
                    {[0, 1, 2, 3, 4].map(l => (
                        <span key={l} className={`heatmap-cell level-${l} state-${l > 0 ? 'done' : 'missed'}`} />
                    ))}
                    <span>More</span>
                </div>
            </div>
        </div>
    );
};

const describe = (c: Cell): string => {
    if (c.state === 'done') return `${c.value} completed`;
    if (c.state === 'frozen') return 'frozen — streak protected';
    if (c.state === 'notDue') return 'not scheduled';
    return 'missed';
};
