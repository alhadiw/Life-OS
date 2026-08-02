import React from 'react';
import './FullscreenLoader.css';

/**
 * Full-viewport branded loader.
 *
 * One caller since ARCH-1 deleted the once-per-day reset sync: the Suspense boundary
 * around the routes that render outside the app shell (Login, the password-reset
 * landing). Both are cases where there is no layout to hold a skeleton in place,
 * so the honest thing is a spinner and a sentence.
 *
 * Inside the shell, prefer <PageSkeleton /> — it keeps the sidebar and header on
 * screen instead of blanking the whole app.
 */
export const FullscreenLoader: React.FC<{ message?: string }> = ({ message }) => (
    <div className="fullscreen-loader" role="status" aria-live="polite">
        <div className="fullscreen-loader-mark">L</div>
        <div className="fullscreen-loader-spinner" aria-hidden="true" />
        {message && <p className="fullscreen-loader-message">{message}</p>}
    </div>
);
