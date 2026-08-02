import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Enums } from '../lib/supabase';
import { browserTimezone, setUserTimezone } from '../lib/dates';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { invalidate, clearQueryCache } from '../hooks/useQuery';

export type PointsEntryKind = Enums<'points_entry_kind'>;

export interface PointsTransaction {
    id: string;
    timestamp: string;
    points: number;
    source: string;
    monetaryValue: number;
    kind: PointsEntryKind;
}

interface PointsContextType {
    lifetimePoints: number;
    unspentPoints: number;
    conversionRate: number;
    currencySymbol: string;
    totalMoneyEarned: number;
    /** Ledger row count. ARCH-2 replaced the in-memory ledger, and the History
     *  page's "transactions" stat was the only thing that needed its length. */
    entryCount: number;
    addPoints: (points: number, source: string) => Promise<void>;
    removePoints: (points: number, source: string) => Promise<void>;
    spendPoints: (points: number, description: string) => Promise<void>;
    setConversionRate: (rate: number) => Promise<void>;
    setCurrencySymbol: (symbol: string) => Promise<void>;
    clearHistory: () => Promise<void>;
    loading: boolean;
}

const PointsContext = createContext<PointsContextType | undefined>(undefined);

/**
 * The ledger is the only source of truth — there is no balance column.
 *
 * ARCH-2 moved the arithmetic that used to live here into Postgres, as
 * `points_summary()` (supabase/migrations/20260802150300_points_summary.sql).
 * The split it applies must stay exactly this, because commit() below applies
 * the same deltas optimistically and the two cannot be allowed to drift:
 *
 *   lifetime = earns + reversals   (reversals are negative, so they cancel out)
 *   unspent  = lifetime - redemptions
 *   money    = the same split, in currency
 *
 * This is why FIX-1 mattered: the old reload path inferred meaning from the sign
 * of `points`, treating a negative `Reversed:` row as spending, so lifetime
 * points dropped when you un-checked a task and jumped back on refresh.
 */
export const PointsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const toast = useToast();

    const [lifetimePoints, setLifetimePoints] = useState(0);
    const [unspentPoints, setUnspentPoints] = useState(0);
    const [conversionRate, setConversionRateState] = useState(100);
    const [currencySymbol, setCurrencySymbolState] = useState('$');
    const [totalMoneyEarned, setTotalMoneyEarned] = useState(0);
    const [entryCount, setEntryCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            // Sign-out. Every cached row belongs to the account that just left,
            // so the cache goes with it — the same reasoning that keeps Supabase
            // out of the service worker's runtimeCaching.
            clearQueryCache();
            setLoading(false);
            return;
        }

        const fetchProfileData = async () => {
            setLoading(true);
            try {
                // 1. Profile configuration
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('conversion_rate, currency_symbol, timezone')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;

                if (profile) {
                    setConversionRateState(profile.conversion_rate);
                    setCurrencySymbolState(profile.currency_symbol);

                    // FIX-6 — every "what day is it" decision reads from here.
                    // The column is null until we detect it; persist the
                    // browser's guess so the answer is stable across devices.
                    setUserTimezone(profile.timezone);
                    if (!profile.timezone) {
                        const detected = browserTimezone();
                        setUserTimezone(detected);
                        await supabase.from('profiles').update({ timezone: detected }).eq('id', user.id);
                    }
                }

                // 2. The totals — ARCH-2.
                //
                // This used to `select('*')` the entire points_history table and
                // sum it in the loop below. That is on the startup path, so the
                // cost was paid on every single login and grew with the ledger:
                // at 10,000 rows it is megabytes of JSON to transfer and parse
                // before the header can show a number. Indexes do not help, because
                // the expense is transfer and parse, not lookup.
                //
                // points_summary() does the same arithmetic in Postgres and
                // returns one row.
                const { data: totals, error: totalsError } = await supabase
                    .rpc('points_summary')
                    .single();

                if (totalsError) throw totalsError;

                setLifetimePoints(Number(totals.lifetime_points));
                setUnspentPoints(Number(totals.unspent_points));
                setTotalMoneyEarned(Number(totals.lifetime_money));
                setEntryCount(Number(totals.entry_count));
            } catch (err) {
                console.error('Error fetching points data:', err);
                toast.error('Could not load your points. Some totals may be missing — try reloading.');
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
        // `toast` is a stable memo from ToastProvider; re-running on it would
        // refetch the whole ledger for no reason.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    /**
     * Write one ledger row, applying the balance change optimistically and
     * undoing it exactly if the write fails (FIX-2).
     *
     * Every mutation goes through here so there is a single definition of
     * "apply" and "undo", and they cannot drift apart. Deltas are applied with
     * functional state updates, so an undo stays correct even if another
     * transaction lands in between.
     */
    const commit = async (points: number, source: string, kind: PointsEntryKind) => {
        if (!user) return;

        const monetaryValue = points / conversionRate;
        const countsTowardLifetime = kind !== 'redemption';

        const applyDelta = (sign: 1 | -1) => {
            setUnspentPoints(prev => prev + sign * points);
            if (countsTowardLifetime) {
                setLifetimePoints(prev => prev + sign * points);
                setTotalMoneyEarned(prev => prev + sign * monetaryValue);
            }
        };

        applyDelta(1);
        setEntryCount(prev => prev + 1);

        try {
            const { error } = await supabase
                .from('points_history')
                .insert({
                    user_id: user.id,
                    points,
                    source,
                    monetary_value: monetaryValue,
                    kind
                });

            if (error) throw error;

            // The History page owns the rows now (FIX-14), so a new entry
            // invalidates its cached pages rather than being spliced into an
            // in-memory array here.
            invalidate('points:history');
        } catch (err) {
            console.error(`Failed to write ${kind} of ${points} points:`, err);
            applyDelta(-1);
            setEntryCount(prev => prev - 1);
            toast.error(
                kind === 'redemption'
                    ? "Couldn't record that redemption — your points are unchanged."
                    : "Couldn't save those points. Check your connection and try again."
            );
        }
    };

    const addPoints = (points: number, source: string) =>
        commit(points, source, 'earn');

    const removePoints = (points: number, source: string) =>
        commit(-points, `Reversed: ${source}`, 'reversal');

    const spendPoints = async (points: number, description: string) => {
        if (!user) return;
        if (unspentPoints < points) {
            toast.error(`You only have ${unspentPoints.toLocaleString()} points available.`);
            return;
        }
        await commit(-points, `Redemption: ${description}`, 'redemption');
    };

    const setConversionRate = async (rate: number) => {
        if (!user) return;
        const previous = conversionRate;
        setConversionRateState(rate);
        const { error } = await supabase.from('profiles').update({ conversion_rate: rate }).eq('id', user.id);
        if (error) {
            console.error('Failed to save conversion rate:', error);
            setConversionRateState(previous);
            toast.error("Couldn't save your conversion rate.");
        }
    };

    const setCurrencySymbol = async (symbol: string) => {
        if (!user) return;
        const previous = currencySymbol;
        setCurrencySymbolState(symbol);
        const { error } = await supabase.from('profiles').update({ currency_symbol: symbol }).eq('id', user.id);
        if (error) {
            console.error('Failed to save currency symbol:', error);
            setCurrencySymbolState(previous);
            toast.error("Couldn't save your currency symbol.");
        }
    };

    /**
     * Erase the points ledger — and nothing else (FIX-9).
     *
     * This used to also delete every bill, savings goal and investment. The
     * confirm dialog admitted it; the button said only "Clear History". Wiping
     * the Finance Hub is now its own explicit action in Settings.
     */
    const clearHistory = async () => {
        if (!user) return;

        if (!window.confirm(
            'Erase your entire points history? Lifetime points, unspent balance and every '
            + 'transaction will be reset to zero.\n\nThis does not touch your tasks, goals, '
            + 'finances, books or lists. It cannot be undone.'
        )) return;

        const previous = { entryCount, lifetimePoints, unspentPoints, totalMoneyEarned };

        setEntryCount(0);
        setLifetimePoints(0);
        setUnspentPoints(0);
        setTotalMoneyEarned(0);

        const { error } = await supabase.from('points_history').delete().eq('user_id', user.id);

        if (error) {
            console.error('Failed to clear history:', error);
            setEntryCount(previous.entryCount);
            setLifetimePoints(previous.lifetimePoints);
            setUnspentPoints(previous.unspentPoints);
            setTotalMoneyEarned(previous.totalMoneyEarned);
            toast.error("Couldn't clear your history — nothing was deleted.");
            return;
        }

        invalidate('points:history');
        toast.success('Points history cleared.');
    };

    return (
        <PointsContext.Provider value={{
            lifetimePoints,
            unspentPoints,
            conversionRate,
            currencySymbol,
            totalMoneyEarned,
            entryCount,
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
