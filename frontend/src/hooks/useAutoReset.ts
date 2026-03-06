import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { startOfWeek, startOfMonth, format } from 'date-fns';

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
                const today = new Date();
                const currentDaily = format(today, 'yyyy-MM-dd');
                const currentWeekly = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
                const currentMonthly = format(startOfMonth(today), 'yyyy-MM-dd');

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

                // Check Monthly Goals
                if (metadata.last_monthly_reset !== currentMonthly) {
                    await supabase.from('goals').update({ completed: false }).eq('period', 'monthly').eq('user_id', user.id);
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
