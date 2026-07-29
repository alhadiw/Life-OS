import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, X, WifiOff } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import './UpdatePrompt.css';

/**
 * Service worker registration and the "a new version is ready" banner (PWA-2).
 *
 * The plugin is configured with `registerType: 'prompt'`, so nothing updates
 * until the user says so. That matters more than it sounds: a service worker
 * can keep serving a cached build indefinitely, and Phase 1 already produced one
 * situation where old JavaScript running against a migrated database failed
 * silently. An explicit banner turns "why is the app behaving oddly" into a
 * visible, one-tap fix.
 *
 * Rendered once, near the root, outside the auth gate — an update is worth
 * offering whether or not anyone is signed in.
 */
export const UpdatePrompt: React.FC = () => {
    const [needRefresh, setNeedRefresh] = useState(false);
    const [offlineReady, setOfflineReady] = useState(false);
    const [updating, setUpdating] = useState(false);

    // A ref, not state: this is a handle to an external system (the Workbox
    // registration), nothing renders differently because of it, and putting it
    // in state would mean calling setState synchronously inside the effect below
    // for no benefit.
    const updateSW = useRef<((reload?: boolean) => Promise<void>) | null>(null);

    useEffect(() => {
        // registerSW is a no-op in dev (devOptions.enabled is false) and on any
        // browser without service worker support, so this needs no guard.
        updateSW.current = registerSW({
            onNeedRefresh: () => setNeedRefresh(true),
            onOfflineReady: () => setOfflineReady(true),
            onRegisterError: (error: unknown) => {
                // Not worth a toast. A failed registration costs the user
                // nothing except offline support, and the app works regardless.
                console.error('Service worker registration failed:', error);
            }
        });
    }, []);

    // "Ready to work offline" is worth saying once, then getting out of the way.
    useEffect(() => {
        if (!offlineReady) return;
        const timer = setTimeout(() => setOfflineReady(false), 4000);
        return () => clearTimeout(timer);
    }, [offlineReady]);

    const handleUpdate = async () => {
        if (!updateSW.current) return;
        setUpdating(true);
        // `true` tells the waiting worker to take over and reloads the page.
        await updateSW.current(true);
    };

    if (!needRefresh && !offlineReady) return null;

    return createPortal(
        <div className="update-prompt-viewport">
            {needRefresh ? (
                <div className="update-prompt glass-panel" role="status">
                    <RefreshCw size={18} className="update-prompt-icon" />
                    <div className="update-prompt-body">
                        <strong>A new version of Life OS is ready.</strong>
                        <span>Reload to pick up the latest changes.</span>
                    </div>
                    <div className="update-prompt-actions">
                        <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleUpdate}
                            disabled={updating}
                        >
                            {updating ? 'Reloading…' : 'Reload'}
                        </button>
                        <button
                            type="button"
                            className="update-prompt-close"
                            onClick={() => setNeedRefresh(false)}
                            aria-label="Dismiss update notice"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="update-prompt update-prompt-quiet glass-panel" role="status">
                    <WifiOff size={18} className="update-prompt-icon" />
                    <div className="update-prompt-body">
                        <strong>Life OS is ready to work offline.</strong>
                        <span>It will launch without a connection from now on.</span>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};
