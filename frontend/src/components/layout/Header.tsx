import React, { useEffect, useState } from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { Link } from 'react-router-dom';
import { Award, Coins, Wallet } from 'lucide-react';
import './Header.css';

export const Header: React.FC = () => {
    const {
        unspentPoints,
        lifetimePoints,
        conversionRate,
        currencySymbol,
        totalMoneyEarned
    } = usePoints();

    const [animatePoints, setAnimatePoints] = useState(false);
    const [prevPoints, setPrevPoints] = useState(unspentPoints);

    useEffect(() => {
        if (unspentPoints > prevPoints) {
            setAnimatePoints(true);
            const timer = setTimeout(() => setAnimatePoints(false), 800);
            return () => clearTimeout(timer);
        }
        setPrevPoints(unspentPoints);
    }, [unspentPoints, prevPoints]);

    const currentMoney = (unspentPoints / conversionRate).toFixed(2);
    const maxMoney = totalMoneyEarned.toFixed(2);

    return (
        <header className="global-header glass-panel">
            <div className="header-brand">
                <Link to="/">
                    <div className="logo-box">L</div>
                    <h1>Life OS</h1>
                </Link>
            </div>

            <div className="header-stats">
                <div className="stat-item tooltip" title="Lifetime Points">
                    <Award size={20} style={{ color: 'var(--primary-color)' }} />
                    <span className="stat-value">{lifetimePoints.toLocaleString()}</span>
                </div>

                <div className="stat-separator"></div>

                <div className="stat-item tooltip" title="Unspent Points">
                    <Coins size={20} style={{ color: 'var(--warning-color)' }} />
                    <span className={`stat-value ${animatePoints ? 'animate-pulse-points' : ''}`} style={{ fontWeight: 700 }}>
                        {unspentPoints.toLocaleString()}
                    </span>
                </div>

                <div className="stat-separator"></div>

                <div className="stat-item stat-money tooltip" title="Current Value">
                    <Wallet size={20} style={{ color: 'var(--success-color)' }} />
                    <span className="stat-value" style={{ color: 'var(--success-color)', fontWeight: 700 }}>
                        {currencySymbol}{currentMoney}
                    </span>
                </div>

                <div className="stat-separator hidden-mobile"></div>

                <div className="stat-item hidden-mobile tooltip" title="Lifetime Earned">
                    <span className="stat-label">Total Earned:</span>
                    <span className="stat-value">{currencySymbol}{maxMoney}</span>
                </div>
            </div>
        </header>
    );
};
