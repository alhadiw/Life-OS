import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Header } from './Header';
import { LayoutDashboard, CheckSquare, Wallet, BookOpen, Activity, List, History, Settings } from 'lucide-react';
import './Layout.css';

export const Layout: React.FC = () => {
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
                    <Outlet />
                </div>
            </main>

            {/* Mobile nav could be implemented here for small screens */}
            <nav className="mobile-nav glass-panel">
                <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end>
                    <LayoutDashboard size={24} />
                </NavLink>
                <NavLink to="/tasks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <CheckSquare size={24} />
                </NavLink>
                <NavLink to="/finance" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <Wallet size={24} />
                </NavLink>
                <NavLink to="/books" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <BookOpen size={24} />
                </NavLink>
                <NavLink to="/settings" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                    <Settings size={24} />
                </NavLink>
            </nav>
        </div>
    );
};
