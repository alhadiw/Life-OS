import React from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { Link } from 'react-router';
import { Coins } from 'lucide-react';
import './Header.css';

/**
 * The points header.
 *
 * It used to show four numbers — lifetime points, unspent points, current value
 * and lifetime earned — separated only by small coloured icons, with their
 * meanings in `title` tooltips. Tooltips do not exist on touch, and this is a
 * PWA whose primary target is a phone, so in practice it was four unlabelled
 * figures. Worse on the default 1:1 conversion rate, where lifetime points and
 * lifetime earned render as the same number twice.
 *
 * Now it answers the one question a header should: what can I spend right now,
 * and what is that worth. Lifetime totals live on /history, which is where you
 * go to look at them, and which already shows both.
 *
 * FIX-10 is gone with the state that caused it. The pulse used to be a
 * `useState` flag set from an effect that compared against a `prevPoints` value
 * only updated in the non-animating branch, so it went stale after a gain and
 * could mis-fire. Keying the element on the balance makes React remount it
 * whenever the number changes, which replays the CSS animation — no state, no
 * effect, nothing to go stale. It now pulses on spends too; a balance changing
 * is worth acknowledging in either direction.
 */
export const Header: React.FC = () => {
    const { unspentPoints, conversionRate, currencySymbol } = usePoints();

    const currentMoney = (unspentPoints / conversionRate).toFixed(2);

    return (
        <header className="global-header glass-panel">
            <div className="header-brand">
                <Link to="/">
                    <div className="logo-box">L</div>
                    <h1>Life OS</h1>
                </Link>
            </div>

            <Link to="/history" className="header-stats" aria-label="Points balance — open history">
                <div className="stat-item">
                    <Coins size={18} style={{ color: 'var(--warning-color)' }} aria-hidden="true" />
                    <div className="stat-pair">
                        <span className="stat-label">Balance</span>
                        <span key={unspentPoints} className="stat-value animate-pulse-points">
                            {unspentPoints.toLocaleString()}
                        </span>
                    </div>
                </div>

                <div className="stat-separator" />

                <div className="stat-item">
                    <div className="stat-pair">
                        <span className="stat-label">Worth</span>
                        <span key={currentMoney} className="stat-value stat-money animate-pulse-points">
                            {currencySymbol}{currentMoney}
                        </span>
                    </div>
                </div>
            </Link>
        </header>
    );
};
