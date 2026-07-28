import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import './Toast.css';

export type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
    id: number;
    variant: ToastVariant;
    message: string;
}

interface ToastContextType {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const DURATION_MS: Record<ToastVariant, number> = {
    success: 3000,
    info: 4000,
    // Errors stay longer — they usually mean something didn't save, and that is
    // worth reading properly.
    error: 6000
};

const ICONS: Record<ToastVariant, React.ElementType> = {
    success: CheckCircle2,
    error: AlertTriangle,
    info: Info
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(1);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const push = useCallback((variant: ToastVariant, message: string) => {
        const id = nextId.current++;
        setToasts(prev => [...prev, { id, variant, message }]);
        setTimeout(() => dismiss(id), DURATION_MS[variant]);
    }, [dismiss]);

    const api = useMemo<ToastContextType>(() => ({
        success: (message: string) => push('success', message),
        error: (message: string) => push('error', message),
        info: (message: string) => push('info', message),
        dismiss
    }), [push, dismiss]);

    return (
        <ToastContext.Provider value={api}>
            {children}
            {createPortal(
                <div className="toast-viewport" role="region" aria-label="Notifications">
                    {toasts.map(toast => {
                        const Icon = ICONS[toast.variant];
                        return (
                            <div
                                key={toast.id}
                                className={`toast toast-${toast.variant} glass-panel`}
                                role={toast.variant === 'error' ? 'alert' : 'status'}
                            >
                                <Icon size={18} className="toast-icon" />
                                <span className="toast-message">{toast.message}</span>
                                <button
                                    type="button"
                                    className="toast-close"
                                    onClick={() => dismiss(toast.id)}
                                    aria-label="Dismiss notification"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
};

// Provider and hook live together, matching AuthContext and PointsContext. The
// cost is that this file isn't Fast-Refresh-eligible, which doesn't matter for a
// context that's mounted once at the root.
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
