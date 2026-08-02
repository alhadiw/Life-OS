import React, { useMemo } from 'react';
import { addDays, parseISODate, todayISO } from '../lib/dates';
import './Heatmap.css';

/**
 * HAB-4 — GitHub-contributions-style year heatmap.
 *
 * This is the payoff for ARCH-1. It is only drawable at all because completion
 * rows survive instead of being cleared nightly; under the old model every
 * square before today would be blank forever.
 *
 * Rendered as a CSS grid of 7 rows (Sun–Sat) flowing in columns, so each column
 * is one week — the same reading order as GitHub's. Weeks run left (oldest) to
 * right (most recent).
 */

export interface HeatmapProps {
    /** ISO dates with a completion. Values are the intensity to shade by. */
    values: Map<string, number>;
    /** How many days back to draw. 371 = 53 whole weeks. */
    days?: number;
    /** Highest value that still maps to a shade; above this everything is level 4. */
    max?: number;
    endISO?: string;
    /** Rendered above the grid. */
    title?: string;
    colorVar?: string;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Cell {
    iso: string;
    level: number;
    value: number;
}

export const Heatmap: React.FC<HeatmapProps> = ({
    values,
    days = 371,
    max = 1,
    endISO = todayISO(),
    title,
    colorVar = '--success-color'
}) => {
    const { cells, monthMarks, weeks } = useMemo(() => {
        // End on the Saturday of the current week so the final column is whole
        // and today is never orphaned in a half-drawn week.
        const endWeekday = parseISODate(endISO).getDay();
        const gridEnd = addDays(endISO, 6 - endWeekday);
        const gridStart = addDays(gridEnd, -(days - 1));
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
                out.push({ iso, level, value });
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
    }, [values, days, max, endISO]);

    const total = useMemo(() => {
        let n = 0;
        for (const c of cells) if (c.value > 0) n++;
        return n;
    }, [cells]);

    return (
        <div className="heatmap">
            {title && (
                <div className="heatmap-head">
                    <span className="heatmap-title">{title}</span>
                    <span className="heatmap-count">{total} {total === 1 ? 'day' : 'days'}</span>
                </div>
            )}

            {/* The grid can exceed the viewport on a phone; it scrolls inside
                its own container so the page body never scrolls sideways. */}
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
                            title
                                ? `${title}: ${total} days completed in the last ${Math.round(days / 7)} weeks`
                                : `${total} days completed in the last ${Math.round(days / 7)} weeks`
                        }
                    >
                        {cells.map(c => (
                            <span
                                key={c.iso}
                                className={`heatmap-cell level-${c.level}`}
                                title={`${c.iso} — ${c.value > 0 ? `${c.value} completed` : 'nothing'}`}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="heatmap-legend">
                <span>Less</span>
                {[0, 1, 2, 3, 4].map(l => (
                    <span key={l} className={`heatmap-cell level-${l}`} />
                ))}
                <span>More</span>
            </div>
        </div>
    );
};
