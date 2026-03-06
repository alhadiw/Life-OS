import React, { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', id, ...props }) => {
    // Auto-generate id if not provided but label is
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).substr(2, 5) : undefined);

    return (
        <div className={`input-group ${className}`}>
            {label && <label htmlFor={inputId} className="input-label">{label}</label>}
            <input
                id={inputId}
                className={`input-field ${error ? 'input-error' : ''}`}
                {...props}
            />
            {error && <span className="input-error-msg">{error}</span>}
        </div>
    );
};
