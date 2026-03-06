import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

export interface PointsTransaction {
    id: string;
    timestamp: string;
    points: number;
    source: string;
    monetaryValue: number;
}

interface PointsContextType {
    lifetimePoints: number;
    unspentPoints: number;
    conversionRate: number;
    currencySymbol: string;
    totalMoneyEarned: number;
    history: PointsTransaction[];
    addPoints: (points: number, source: string) => Promise<void>;
    removePoints: (points: number, source: string) => Promise<void>;
    spendPoints: (points: number, description: string) => Promise<void>;
    setConversionRate: (rate: number) => Promise<void>;
    setCurrencySymbol: (symbol: string) => Promise<void>;
    clearHistory: () => Promise<void>;
    loading: boolean;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    const [lifetimePoints, setLifetimePoints] = useState(0);
    const [unspentPoints, setUnspentPoints] = useState(0);
    const [conversionRate, setConversionRateState] = useState(100);
    const [currencySymbol, setCurrencySymbolState] = useState('$');
    const [totalMoneyEarned, setTotalMoneyEarned] = useState(0);
    const [history, setHistory] = useState<PointsTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // 1. Fetch Profile configuration
                const { data: profileError, error: pe } = await supabase
                    .from('profiles')
                    .select('conversion_rate, currency_symbol')
                    .eq('id', user.id)
                    .single();

                if (!pe && profileError) {
                    setConversionRateState(profileError.conversion_rate);
                    setCurrencySymbolState(profileError.currency_symbol);
                }

                // 2. Fetch Points History to calculate totals
                const { data: txData, error: txError } = await supabase
                    .from('points_history')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (txError) throw txError;

                if (txData) {
                    let totalEarned = 0;
                    let totalSpent = 0;
                    let totalMoney = 0;

                    const formattedTx: PointsTransaction[] = txData.map(tx => {
                        if (tx.points > 0) {
                            totalEarned += tx.points;
                            totalMoney += Number(tx.monetary_value);
                        } else {
                            totalSpent += Math.abs(tx.points);
                        }

                        return {
                            id: tx.id,
                            timestamp: tx.created_at,
                            points: tx.points,
                            source: tx.source,
                            monetaryValue: Number(tx.monetary_value)
                        };
                    });

                    setLifetimePoints(totalEarned);
                    setUnspentPoints(totalEarned - totalSpent);
                    setTotalMoneyEarned(totalMoney);
                    setHistory(formattedTx);
                }
            } catch (err) {
                console.error("Error fetching points data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
    }, [user]);

    const addPoints = async (points: number, source: string) => {
        if (!user) return;
        const value = points / conversionRate;

        // Optimistic update
        setLifetimePoints(prev => prev + points);
        setUnspentPoints(prev => prev + points);
        setTotalMoneyEarned(prev => prev + value);

        const tempTx: PointsTransaction = {
            id: 'temp-' + Date.now(),
            timestamp: new Date().toISOString(),
            points,
            source,
            monetaryValue: value
        };
        setHistory(prev => [tempTx, ...prev]);

        // DB update
        try {
            const { data, error } = await supabase.from('points_history').insert({
                user_id: user.id,
                points,
                source,
                monetary_value: value
            }).select().single();

            if (error) throw error;

            // Swap temp ID with real ID
            if (data) {
                setHistory(prev => prev.map(t => t.id === tempTx.id ? { ...t, id: data.id } : t));
            }
        } catch (err) {
            console.error("Failed to add points:", err);
            // In a real app, we'd revert the optimistic update here and show a toast
        }
    };

    const removePoints = async (points: number, source: string) => {
        if (!user) return;
        const value = points / conversionRate;

        // Optimistic update
        setLifetimePoints(prev => Math.max(0, prev - points));
        setUnspentPoints(prev => prev - points);
        setTotalMoneyEarned(prev => Math.max(0, prev - value));

        const tempTx: PointsTransaction = {
            id: 'temp-' + Date.now(),
            timestamp: new Date().toISOString(),
            points: -points,
            source: `Reversed: ${source}`,
            monetaryValue: -value
        };
        setHistory(prev => [tempTx, ...prev]);

        // DB update
        try {
            await supabase.from('points_history').insert({
                user_id: user.id,
                points: -points,
                source: tempTx.source,
                monetary_value: -value
            });
        } catch (err) {
            console.error("Failed to remove points:", err);
        }
    };

    const spendPoints = async (points: number, description: string) => {
        if (!user || unspentPoints < points) return;

        const value = -(points / conversionRate);

        // Optimistic
        setUnspentPoints(prev => prev - points);

        const tempTx: PointsTransaction = {
            id: 'temp-' + Date.now(),
            timestamp: new Date().toISOString(),
            points: -points,
            source: `Redemption: ${description}`,
            monetaryValue: value
        };
        setHistory(prev => [tempTx, ...prev]);

        // DB update
        try {
            await supabase.from('points_history').insert({
                user_id: user.id,
                points: -points,
                source: tempTx.source,
                monetary_value: value
            });
        } catch (err) {
            console.error("Failed to spend points:", err);
        }
    };

    const setConversionRate = async (rate: number) => {
        if (!user) return;
        setConversionRateState(rate);
        try {
            await supabase.from('profiles').update({ conversion_rate: rate }).eq('id', user.id);
        } catch (e) {
            console.error(e);
        }
    };

    const setCurrencySymbol = async (symbol: string) => {
        if (!user) return;
        setCurrencySymbolState(symbol);
        try {
            await supabase.from('profiles').update({ currency_symbol: symbol }).eq('id', user.id);
        } catch (e) {
            console.error(e);
        }
    };

    const clearHistory = async () => {
        if (!user) return;

        if (!window.confirm("Are you sure you want to completely erase your points, transaction history, AND your Finance Hub data (Savings, Bills, Investments)? Your points will be reset to 0.")) return;

        // Optimistic
        setHistory([]);
        setLifetimePoints(0);
        setUnspentPoints(0);
        setTotalMoneyEarned(0);

        try {
            await Promise.all([
                supabase.from('points_history').delete().eq('user_id', user.id),
                supabase.from('finance_bills').delete().eq('user_id', user.id),
                supabase.from('finance_savings').delete().eq('user_id', user.id),
                supabase.from('finance_investments').delete().eq('user_id', user.id)
            ]);
            window.location.reload(); // Force a total reload to clear the Finance UI state as well
        } catch (err) {
            console.error("Failed to clear history:", err);
            window.location.reload();
        }
    };

    return (
        <PointsContext.Provider value={{
            lifetimePoints,
            unspentPoints,
            conversionRate,
            currencySymbol,
            totalMoneyEarned,
            history,
            addPoints,
            removePoints,
            spendPoints,
            setConversionRate,
            setCurrencySymbol,
            clearHistory,
            loading
        }}>
            {children}
        </PointsContext.Provider>
    );
};

export const usePoints = () => {
    const context = useContext(PointsContext);
    if (context === undefined) {
        throw new Error('usePoints must be used within a PointsProvider');
    }
    return context;
};
