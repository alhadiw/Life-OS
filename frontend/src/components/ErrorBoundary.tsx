import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './ui/Button';
import './ErrorBoundary.css';

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

/**
 * Catches render-time crashes so a bug in one page shows a recoverable screen
 * instead of a blank white document. Without this, any thrown error in the tree
 * unmounts the whole app and the user has no way back other than guessing that
 * a reload might help.
 *
 * Still a class component — React has no hooks equivalent for error boundaries.
 *
 * Note this only catches errors thrown during render, in lifecycle methods, and
 * in constructors. It does not catch errors inside event handlers or async
 * work; those surface through the toast system instead.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Replaced with a real reporter when SHR-7 (Sentry) lands.
        console.error('Unhandled render error:', error, info.componentStack);
    }

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="error-boundary-screen">
                <div className="glass-panel error-boundary-card">
                    <AlertTriangle size={40} style={{ color: 'var(--danger-color)' }} />
                    <h2>Something broke</h2>
                    <p className="text-secondary">
                        Life OS hit an unexpected error and stopped. Your data is safe — nothing was
                        deleted. Reloading usually clears it.
                    </p>
                    <pre className="error-boundary-detail">{error.message}</pre>
                    <div className="error-boundary-actions">
                        <Button onClick={() => window.location.reload()}>
                            <RotateCcw size={16} /> Reload Life OS
                        </Button>
                        <Button variant="ghost" onClick={() => this.setState({ error: null })}>
                            Try again without reloading
                        </Button>
                    </div>
                </div>
            </div>
        );
    }
}
