import React from 'react';

interface CardProps {
    children: React.ReactNode;
    className?: string;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    glass?: boolean;
    hoverable?: boolean;
    onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
    children,
    className = '',
    padding = 'md',
    glass = false,
    hoverable = false,
    onClick
}) => {
    return (
        <div
            className={`card p-${padding} ${glass ? 'glass-panel' : ''} ${hoverable ? 'card-hoverable' : ''} ${className}`}
            onClick={onClick}
        >
            {children}
        </div>
    );
};
