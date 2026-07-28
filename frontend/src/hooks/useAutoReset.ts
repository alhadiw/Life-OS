import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { todayISO, startOfWeekISO, startOfMonthISO } from '../lib/dates';

export const useAutoReset = () => {
    const { user } = useAuth();
    const [isResetting, setIsResetting] = useState(true);

    useEffect(() => {
        if (!user) {
            setIsResetting(false);
            return;
        }

        const checkResets = async () => {
            try {
                // FIX-6 — rollover happens at midnight in the *user's* zone.
                // (If the profile hasn't loaded yet this falls back to the
                // browser's zone, which is what it always used before.)
                const currentDaily = todayISO();
                const currentWeekly = startOfWeekISO(currentDaily);
                const currentMonthly = startOfMonthISO(currentDaily);

                const metadata = user.user_metadata || {};
                let needsUpdate = false;
                const newMetadata = { ...metadata };

                // Check Daily Tasks
                if (metadata.last_daily_reset !== currentDaily) {
                    await supabase.from('tasks').update({ completed: false }).eq('user_id', user.id);
                    newMetadata.last_daily_reset = currentDaily;
                    needsUpdate = true;
                }

                // Check Weekly Goals
                if (metadata.last_weekly_reset !== currentWeekly) {
                    await supabase.from('goals').update({ completed: false }).eq('period', 'weekly').eq('user_id', user.id);
                    newMetadata.last_weekly_reset = currentWeekly;
                    needsUpdate = true;
                }

                // Check Monthly Goals & Bills
                if (metadata.last_monthly_reset !== currentMonthly) {
                    await supabase.from('goals').update({ completed: false }).eq('period', 'monthly').eq('user_id', user.id);

                    // Reset recurring monthly bills: un-pay them and advance their due_date to the current month
                    const { data: billsData } = await supabase.from('finance_bills').select('id, due_date').eq('frequency', 'monthly').eq('user_id', user.id);
                    if (billsData && billsData.length > 0) {
                        const [year, month] = currentDaily.split('-').map(Number);
                        // Day 0 of the following month is the last day of this one.
                        const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

                        for (const bill of billsData) {
                            // Keep the same day-of-month, clamped so that a bill
                            // due on the 31st lands on the 30th in a short month
                            // rather than rolling forward into the next one.
                            const day = Math.min(Number(bill.due_date.slice(8, 10)), lastDayOfMonth);
                            const newDueDate = `${currentMonthly.slice(0, 8)}${String(day).padStart(2, '0')}`;

                            await supabase.from('finance_bills').update({
                                paid: false,
                                due_date: newDueDate
                            }).eq('id', bill.id);
                        }
                    }

                    newMetadata.last_monthly_reset = currentMonthly;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    await supabase.auth.updateUser({ data: newMetadata });
                }
            } catch (error) {
                console.error("Error during automatic resets:", error);
            } finally {
                setIsResetting(false);
            }
        };

        checkResets();
    }, [user]);

    return { isResetting };
};
