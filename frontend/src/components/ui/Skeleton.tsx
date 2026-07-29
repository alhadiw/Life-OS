import React from 'react';
import './Skeleton.css';

/**
 * Loading placeholders (PWA-5).
 *
 * Every page used to render a centred "Loading tasks…" string, which tells you
 * the app is busy but reflows the whole layout the moment data lands. A
 * skeleton reserves the space the real content will occupy, so the page stops
 * jumping and the wait reads as shorter than it is.
 *
 * All of these are decorative. They carry `aria-hidden`, and the container that
 * holds them announces the loading state once via `role="status"` — a screen
 * reader should hear "Loading tasks", not eleven empty boxes.
 */

interface SkeletonProps {
    width?: string;
    height?: string;
    radius?: string;
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    width = '100%',
    height = '1rem',
    radius = 'var(--radius-sm)',
    className = ''
}) => (
    <span
        className={`skeleton ${className}`}
        style={{ width, height, borderRadius: radius }}
        aria-hidden="true"
    />
);

/** A stack of card-shaped placeholders — the list pages' main content. */
export const SkeletonList: React.FC<{ count?: number; label?: string }> = ({
    count = 4,
    label = 'Loading'
}) => (
    <div className="skeleton-list" role="status" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
            <div className="skeleton-row" key={i}>
                <Skeleton width="24px" height="24px" radius="6px" />
                <div className="skeleton-row-body">
                    {/* Staggered widths so the block reads as text, not a grid. */}
                    <Skeleton width={`${68 - i * 6}%`} height="1.0625rem" />
                    <Skeleton width="84px" height="0.75rem" />
                </div>
                <Skeleton width="52px" height="1.5rem" radius="var(--radius-full)" />
            </div>
        ))}
    </div>
);

/** A responsive grid of card placeholders — Books, Lists, Exercise goals. */
export const SkeletonGrid: React.FC<{ count?: number; height?: string; label?: string }> = ({
    count = 6,
    height = '150px',
    label = 'Loading'
}) => (
    <div className="skeleton-grid" role="status" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} height={height} radius="var(--radius-lg)" />
        ))}
    </div>
);

/** Wide stat tiles, as used across the top of Dashboard and Finance. */
export const SkeletonStats: React.FC<{ count?: number; label?: string }> = ({
    count = 4,
    label = 'Loading'
}) => (
    <div className="skeleton-stats" role="status" aria-label={label}>
        {Array.from({ length: count }, (_, i) => (
            <Skeleton key={i} height="92px" radius="var(--radius-lg)" />
        ))}
    </div>
);

/**
 * Whole-page fallback for a route that hasn't finished downloading yet
 * (the Suspense boundary around each React.lazy page in App.tsx).
 *
 * Deliberately generic: this shows for a few hundred milliseconds on a cold
 * navigation, and a shape that guessed wrong about the page would flash the
 * wrong layout. Header, stats, list — true of nearly every page here.
 */
export const PageSkeleton: React.FC = () => (
    <div className="skeleton-page animate-fade-in" role="status" aria-label="Loading page">
        <div className="skeleton-page-head">
            <Skeleton width="220px" height="2rem" />
            <Skeleton width="120px" height="2.5rem" radius="var(--radius-md)" />
        </div>
        <SkeletonStats count={3} label="Loading" />
        <SkeletonList count={4} label="Loading" />
    </div>
);
