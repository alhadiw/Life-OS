import React, { Suspense, useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router';
import { Header } from './Header';
import { PageSkeleton } from '../ui/Skeleton';
import { LayoutDashboard, CheckSquare, Flame, Wallet, BookOpen, Activity, List, History, Settings, MoreHorizontal, X } from 'lucide-react';
import './Layout.css';

/**
 * Bottom bar holds four destinations; the rest live behind "More".
 *
 * The bar used to list all nine routes with `overflow-x: auto`. On a 390px
 * phone that is roughly 550px of content, so Points History and Settings sat
 * off-screen with no scroll affordance — reachable only by accident. Four plus
 * an overflow sheet keeps every route one tap away and the tap targets full
 * width.
 */
const PRIMARY = [
    { to: '/', label: 'Dashboard', Icon: LayoutDashboard, end: true },
    { to: '/tasks', label: 'Tasks', Icon: CheckSquare },
    { to: '/habits', label: 'Habits', Icon: Flame },
    { to: '/finance', label: 'Finance', Icon: Wallet }
];

const OVERFLOW = [
    { to: '/books', label: 'Books', Icon: BookOpen },
    { to: '/exercise', label: 'Exercise', Icon: Activity },
    { to: '/lists', label: 'My Lists', Icon: List },
    { to: '/history', label: 'Points History', Icon: History },
    { to: '/settings', label: 'Settings', Icon: Settings }
];

export const Layout: React.FC = () => {
    const [moreOpen, setMoreOpen] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => {
        if (!moreOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [moreOpen]);

    const overflowActive = OVERFLOW.some(i => pathname.startsWith(i.to));

    return (
        <div className="app-layout">
            <nav className="desktop-sidebar glass-panel">
                <div className="sidebar-logo">
                    <div className="logo-box">L</div>
                    <h2>Life OS</h2>
                </div>

                <div className="nav-links">
                    <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
                        <LayoutDashboard size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/tasks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <CheckSquare size={20} /> Tasks & Goals
                    </NavLink>
                    <NavLink to="/habits" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <Flame size={20} /> Habits
                    </NavLink>
                    <NavLink to="/finance" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <Wallet size={20} /> Finance Hub
                    </NavLink>
                    <NavLink to="/books" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <BookOpen size={20} /> Books
                    </NavLink>
                    <NavLink to="/exercise" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <Activity size={20} /> Exercise
                    </NavLink>
                    <NavLink to="/lists" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <List size={20} /> My Lists
                    </NavLink>
                </div>

                <div className="nav-footer">
                    <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <History size={20} /> Points History
                    </NavLink>
                    <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                        <Settings size={20} /> Settings
                    </NavLink>
                </div>
            </nav>

            <main className="main-content">
                <Header />
                <div className="page-container animate-fade-in">
                    {/* PWA-5: pages are lazy, so navigating to one that hasn't
                        downloaded yet suspends. Catching that here — inside the
                        shell — means the nav and the points header stay on
                        screen and only the content area shows a skeleton. */}
                    <Suspense fallback={<PageSkeleton />}>
                        <Outlet />
                    </Suspense>
                </div>
            </main>

            {/* Mobile nav — four routes plus an overflow sheet. */}
            {moreOpen && (
                <>
                    <div className="mobile-more-overlay" onClick={() => setMoreOpen(false)} />
                    <div className="mobile-more-sheet glass-panel" role="dialog" aria-label="More pages">
                        <div className="mobile-more-head">
                            <span>More</span>
                            <button
                                className="icon-btn"
                                onClick={() => setMoreOpen(false)}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        {OVERFLOW.map(({ to, label, Icon }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) => isActive ? 'mobile-more-link active' : 'mobile-more-link'}
                                onClick={() => setMoreOpen(false)}
                            >
                                <Icon size={20} /> {label}
                            </NavLink>
                        ))}
                    </div>
                </>
            )}

            <nav className="mobile-nav glass-panel">
                {PRIMARY.map(({ to, label, Icon, end }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={end}
                        className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
                        aria-label={label}
                    >
                        <Icon size={22} />
                        <span className="nav-caption">{label}</span>
                    </NavLink>
                ))}
                <button
                    type="button"
                    className={`nav-link ${overflowActive || moreOpen ? 'active' : ''}`}
                    onClick={() => setMoreOpen(v => !v)}
                    aria-expanded={moreOpen}
                    aria-label="More pages"
                >
                    <MoreHorizontal size={22} />
                    <span className="nav-caption">More</span>
                </button>
            </nav>

        </div>
    );
};
