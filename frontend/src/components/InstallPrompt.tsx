import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Share, Plus, X } from 'lucide-react';
import './InstallPrompt.css';

/**
 * "Install this app" banner (PWA-10).
 *
 * Two completely different mechanisms behind one component:
 *
 *  - Chrome, Edge and Android fire `beforeinstallprompt`. Capture it, suppress
 *    the browser's own mini-infobar, and drive the real install dialog from our
 *    button.
 *  - iOS Safari fires nothing and offers no API. Add to Home Screen is buried
 *    in the Share sheet, and nobody finds it on their own — which matters here,
 *    because on iOS that menu item is the *only* way to get the app icon,
 *    fullscreen chrome and (later, PWA-8) push notifications. All we can do is
 *    point at it.
 *
 * Both are suppressed once the app is already installed, and a dismissal is
 * remembered so this never becomes nagware.
 */

/** Not in lib.dom.d.ts — Chromium-only, still non-standard. */
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'lifeos:install-prompt-dismissed-at';

// Long enough that a "not now" is genuinely respected, short enough that
// someone who has since started using the app daily gets asked again.
const DISMISS_DAYS = 30;

// Let the page settle before asking for anything. A banner that appears in the
// same frame as the login form is an advert; one that appears once you are
// clearly using the thing is an offer.
const APPEAR_DELAY_MS = 4000;

const isStandalone = (): boolean => {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    // iOS Safari's own non-standard flag, set when launched from the home
    // screen. It predates display-mode and is still the only signal there.
    const nav = window.navigator;
    return 'standalone' in nav && Boolean(nav.standalone);
};

const isIOSSafari = (): boolean => {
    const ua = navigator.userAgent;
    // iPadOS 13+ reports a desktop Mac UA; the touch-point count gives it away.
    const iOS = /iphone|ipod|ipad/i.test(ua) ||
        (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
    // Add to Home Screen only produces a real standalone app in Safari, so the
    // Share-sheet instructions would be wrong for Chrome or Firefox on iOS.
    const safari = /safari/i.test(ua) && !/crios|fxios|edgios|opios|brave/i.test(ua);
    return iOS && safari;
};

const wasRecentlyDismissed = (): boolean => {
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return false;
        const elapsed = Date.now() - Number(raw);
        return Number.isFinite(elapsed) && elapsed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
        // Safari in private mode throws on localStorage. Failing "not dismissed"
        // is the harmless direction — worst case the banner shows again.
        return false;
    }
};

export const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showIOSHint, setShowIOSHint] = useState(false);
    const [visible, setVisible] = useState(false);

    const dismiss = useCallback(() => {
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            // Private mode. The banner is gone for this session either way.
        }
    }, []);

    useEffect(() => {
        if (isStandalone() || wasRecentlyDismissed()) return;

        // --- Chromium ---------------------------------------------------------
        const onBeforeInstallPrompt = (event: Event) => {
            // Stops the browser's own banner so ours is the only one.
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setVisible(true);
        };

        // --- Installed while we were open ------------------------------------
        const onInstalled = () => {
            setVisible(false);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.addEventListener('appinstalled', onInstalled);

        // --- iOS Safari -------------------------------------------------------
        let timer: number | undefined;
        if (isIOSSafari()) {
            timer = window.setTimeout(() => {
                setShowIOSHint(true);
                setVisible(true);
            }, APPEAR_DELAY_MS);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
            window.removeEventListener('appinstalled', onInstalled);
            if (timer) clearTimeout(timer);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        // The event is single-use whatever the answer. Declining counts as a
        // dismissal — asking again next week would be pestering.
        setDeferredPrompt(null);
        setVisible(false);
        if (outcome === 'dismissed') dismiss();
    };

    if (!visible) return null;

    return createPortal(
        <div className="install-prompt glass-panel" role="dialog" aria-label="Install Life OS">
            <div className="install-prompt-mark" aria-hidden="true">L</div>

            <div className="install-prompt-body">
                <strong>Add Life OS to your home screen</strong>
                {showIOSHint ? (
                    <span className="install-prompt-steps">
                        Tap <Share size={14} aria-label="the Share button" /> in the Safari toolbar,
                        then <Plus size={14} aria-hidden="true" /> <em>Add to Home Screen</em>.
                    </span>
                ) : (
                    <span>Launches instantly, works offline, no App Store needed.</span>
                )}
            </div>

            {!showIOSHint && (
                <button type="button" className="btn btn-primary btn-sm" onClick={handleInstall}>
                    <Download size={16} /> Install
                </button>
            )}

            <button
                type="button"
                className="install-prompt-close"
                onClick={dismiss}
                aria-label="Dismiss install prompt"
            >
                <X size={16} />
            </button>
        </div>,
        document.body
    );
};
