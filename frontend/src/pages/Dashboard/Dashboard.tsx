import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useQuery, fromSupabase, invalidate, setQueryData } from '../../hooks/useQuery';
import { useToast } from '../../contexts/ToastContext';
import { todayISO, addDays, startOfWeekISO, startOfMonthISO } from '../../lib/dates';
import { celebrate, originFromElement, type CelebrationOrigin } from '../../lib/celebrate';
import { SkeletonGrid, SkeletonList, SkeletonStats } from '../../components/ui/Skeleton';
import { Check, WalletCards, BookOpen, Activity, Plus, Gift, List } from 'lucide-react';
import { Link } from 'react-router';
import { listIcon } from '../../lib/listIcons';
import './Dashboard.css';

/** The subset of a task this widget needs; the full row lives on /tasks. */
interface DashboardTask {
    id: string;
    title: string;
    points: number;
    completed: boolean;
}

const DashboardView: React.FC = () => {
    const { addPoints, removePoints, currencySymbol } = usePoints();
    const { user } = useAuth();
    const toast = useToast();

    const [quickTaskText, setQuickTaskText] = useState('');
    const [rewardText, setRewardText] = useState('');
    const [rewardPoints, setRewardPoints] = useState<number | ''>('');
    const [rewardSuccess, setRewardSuccess] = useState(false);

    const today = todayISO();

    /**
     * ARCH-3 — the Dashboard is one view, so it is one cached query. Mutations
     * elsewhere call `invalidate('dashboard')`, which is what finally makes
     * completing a task on /tasks correct the widget here without a navigation.
     */
    const dash = useQuery(user ? `dashboard:${today}` : null, async () => {
        const period = startOfMonthISO(today);

        const [tasksData, taskComps, allTaskComps, goalsData, goalComps, billsData, paidThisMonth,
            savingsData, invData, workoutsThisWeek, listsData] = await Promise.all([
                // 1. Today's tasks (FIX-7). A task belongs to today if it has no
                // due date or is due today or earlier. Inbox captures (TSK-3) are
                // excluded — untriaged notes are not today's commitments.
                fromSupabase(supabase.from('tasks').select('*').eq('inbox', false)
                    .or(`due_date.is.null,due_date.lte.${today}`)
                    .order('created_at', { ascending: false })),
                fromSupabase(supabase.from('task_completions').select('task_id')
                    .eq('local_date', today)),
                // Finished one-off tasks are gone for good; only recurring ones
                // come back. Matches the Tasks page rule.
                fromSupabase(supabase.from('task_completions').select('task_id')),
                // 2. Goals — complete when a row exists for the current period.
                fromSupabase(supabase.from('goals').select('id, period')),
                fromSupabase(supabase.from('goal_completions').select('goal_id, period_start')
                    .in('period_start', [startOfWeekISO(today), startOfMonthISO(today)])),
                // 3. Finance. Bills due within 7 days...
                fromSupabase(supabase.from('finance_bills').select('id, amount, due_date')
                    .gte('due_date', today).lte('due_date', addDays(today, 7))),
                // ...minus the ones already paid this month. This used to filter
                // on `finance_bills.paid`, which ARCH-1 made vestigial — nothing
                // writes it any more, so the total was reading a stale column.
                fromSupabase(supabase.from('bill_payments').select('bill_id')
                    .eq('period_month', period)),
                fromSupabase(supabase.from('finance_savings').select('current_amount')),
                fromSupabase(supabase.from('finance_investments').select('amount')),
                // 5. Exercise (FIX-8) — the real count since Monday.
                fromSupabase(supabase.from('exercises').select('id')
                    .gte('exercise_date', startOfWeekISO(today)).lte('exercise_date', today)),
                // 6. Lists
                fromSupabase(supabase.from('user_lists').select('id, name, icon').limit(3))
            ]);

        // These two legitimately return no row for a new account, so they are
        // fetched separately rather than letting a PGRST116 reject the batch.
        const { data: bookData } = await supabase.from('books')
            .select('title, author, cover_image').eq('status', 'reading').limit(1).maybeSingle();
        const { data: exGoal } = await supabase.from('exercise_goals')
            .select('target_value').eq('period', 'weekly').limit(1).maybeSingle();

        const doneToday = new Set(taskComps.map(c => c.task_id));
        const everDone = new Set(allTaskComps.map(c => c.task_id));
        const doneGoals = new Set(goalComps.map(c => c.goal_id));
        const paid = new Set(paidThisMonth.map(p => p.bill_id));
        const weekly = goalsData.filter(g => g.period === 'weekly');
        const monthly = goalsData.filter(g => g.period === 'monthly');

        return {
            dailyTasks: tasksData
                .filter(t => t.recurring || !everDone.has(t.id) || doneToday.has(t.id))
                .map(t => ({ id: t.id, title: t.title, points: t.points, completed: doneToday.has(t.id) }))
                // What's still outstanding matters more than what's done.
                .sort((a, b) => Number(a.completed) - Number(b.completed)),
            weeklyGoals: { total: weekly.length, completed: weekly.filter(g => doneGoals.has(g.id)).length },
            monthlyGoals: { total: monthly.length, completed: monthly.filter(g => doneGoals.has(g.id)).length },
            finance: {
                upcomingBills: billsData
                    .filter(b => !paid.has(b.id))
                    .reduce((sum, b) => sum + Number(b.amount), 0),
                savings: savingsData.reduce((sum, s) => sum + Number(s.current_amount), 0),
                investments: invData.reduce((sum, i) => sum + Number(i.amount), 0)
            },
            currentBook: bookData,
            exerciseWeek: { sessions: workoutsThisWeek.length, target: exGoal?.target_value ?? 0 },
            userLists: listsData
        };
    });

    const loading = dash.loading;
    const dailyTasks = dash.data?.dailyTasks ?? [];
    const weeklyGoals = dash.data?.weeklyGoals ?? { completed: 0, total: 0 };
    const monthlyGoals = dash.data?.monthlyGoals ?? { completed: 0, total: 0 };
    const finance = dash.data?.finance ?? { upcomingBills: 0, savings: 0, investments: 0 };
    const currentBook = dash.data?.currentBook ?? null;
    const exerciseWeek = dash.data?.exerciseWeek ?? { sessions: 0, target: 0 };
    const userLists = dash.data?.userLists ?? [];

    // --- HANDLERS ---
    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !quickTaskText.trim()) return;

        try {
            const { error } = await supabase.from('tasks').insert({
                user_id: user.id,
                title: quickTaskText,
                points: 25,
                category: 'General',
                inbox: false
            });

            if (error) throw error;
            invalidate('dashboard');
            invalidate('tasks');
            setQuickTaskText('');
        } catch (e) {
            console.error(e);
            toast.error("Couldn't add that task.");
        }
    };

    const handleQuickReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !rewardText.trim() || !rewardPoints || rewardPoints <= 0) return;

        try {
            await addPoints(Number(rewardPoints), `Custom Reward: ${rewardText}`);
            setRewardText('');
            setRewardPoints('');
            setRewardSuccess(true);
            setTimeout(() => setRewardSuccess(false), 3000);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleTask = async (task: DashboardTask, origin?: CelebrationOrigin) => {
        if (!user) return;
        const newCompletedStatus = !task.completed;

        // Optimistic through the cache. Patching only the tasks slice keeps the
        // rest of the dashboard on screen while the write is in flight.
        setQueryData<typeof dash.data>(`dashboard:${today}`, prev => prev && ({
            ...prev,
            dailyTasks: prev.dailyTasks.map(t =>
                t.id === task.id ? { ...t, completed: newCompletedStatus } : t)
        }));

        // Persist the checkbox before awarding points, so a failed write can't
        // leave the ledger crediting a task the database still thinks is open.
        // ARCH-1 — same rule as the Tasks page: the row is the truth.
        const { error } = newCompletedStatus
            ? await supabase.from('task_completions').insert({
                user_id: user.id, task_id: task.id, local_date: todayISO(), points_awarded: task.points
            })
            : await supabase.from('task_completions').delete()
                .eq('task_id', task.id).eq('local_date', todayISO());

        if (error) {
            console.error(error);
            invalidate('dashboard');
            toast.error("Couldn't save that — your points are unchanged.");
            return;
        }

        // The Tasks page lists the same rows; invalidating both is what keeps
        // them agreeing without a navigation.
        invalidate('dashboard');
        invalidate('tasks');

        if (newCompletedStatus) {
            celebrate(origin); // MOT-4, after the write succeeded — see Tasks.tsx.
            await addPoints(task.points, `Quick completed: ${task.title}`);
        } else {
            await removePoints(task.points, `Unchecked: ${task.title}`);
        }
    };

    if (loading) {
        return (
            <div className="animate-fade-in dashboard-layout dashboard-loading">
                <div className="dashboard-main">
                    <SkeletonStats count={2} label="Loading your dashboard" />
                    <SkeletonList count={4} label="Loading today's tasks" />
                </div>
                <div className="dashboard-sidebar">
                    <SkeletonGrid count={2} height="180px" label="Loading summaries" />
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in dashboard-layout">
            {/* LEFT COLUMN: Tasks & Goals */}
            <div className="dashboard-main">
                <div className="page-header mb-md">
                    <h2>Hello!</h2>
                    <p className="text-secondary mt-1">Here is your life at a glance today.</p>
                </div>

                {/* Quick Add */}
                <Card glass padding="sm" className="mb-lg">
                    <form onSubmit={handleQuickAdd} className="quick-add-form">
                        <Plus size={20} className="text-muted" />
                        <input
                            type="text"
                            placeholder="Quick add a daily task..."
                            value={quickTaskText}
                            onChange={e => setQuickTaskText(e.target.value)}
                            className="quick-add-input"
                        />
                        {quickTaskText && <Button type="submit" size="sm">Add</Button>}
                    </form>
                </Card>

                {/* Reward Yourself */}
                <Card glass padding="sm" className="mb-lg">
                    <form onSubmit={handleQuickReward} className="quick-add-form">
                        <Gift size={20} className="text-primary" />
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                                <input
                                    type="text"
                                    placeholder="Reward yourself for..."
                                    value={rewardText}
                                    onChange={e => setRewardText(e.target.value)}
                                    className="quick-add-input"
                                    style={{ flex: 1, minWidth: 0 }}
                                    required
                                />
                                <input
                                    type="number"
                                    placeholder="Pts"
                                    value={rewardPoints}
                                    onChange={e => setRewardPoints(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="quick-add-input"
                                    style={{ width: '70px', flex: 'none' }}
                                    min="1"
                                    required
                                />
                                <Button type="submit" size="sm" variant="primary">Claim</Button>
                            </div>
                            {rewardSuccess && <div className="text-success text-sm animate-fade-in" style={{ paddingLeft: '0.5rem' }}>Points awarded successfully!</div>}
                        </div>
                    </form>
                </Card>

                {/* Today's Tasks */}
                <div className="widget mb-lg">
                    <div className="widget-header">
                        <h3>Today's Tasks</h3>
                        <Link to="/tasks" className="widget-link">View All</Link>
                    </div>
                    <div className="widget-content">
                        {dailyTasks.slice(0, 5).map(task => ( // Show top 5
                            <Card key={task.id} hoverable padding="sm" className={`dashboard-task-card mb-sm ${task.completed ? 'completed' : ''}`}>
                                <div className="dashboard-task-inner">
                                    <button
                                        className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                                        onClick={e => toggleTask(task, originFromElement(e.currentTarget))}
                                        aria-label={task.completed ? 'Mark as uncompleted' : 'Mark as completed'}
                                    >
                                        {task.completed && <Check size={14} strokeWidth={3} />}
                                    </button>
                                    <div className="task-details">
                                        <h4 className="task-title">{task.title}</h4>
                                    </div>
                                    <div className="task-points-badge hidden-mobile">
                                        <span className="points-value">+{task.points}</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {dailyTasks.length === 0 && <p className="text-muted text-center py-md">No tasks left today. Enjoy!</p>}
                    </div>
                </div>

                {/* Goal Progress */}
                <div className="goals-summary-grid mb-lg">
                    <Card glass padding="md">
                        <h4 className="mb-sm text-secondary font-medium">Weekly Goals</h4>
                        <div className="goal-summary-stats">
                            <span className="text-lg font-bold">{weeklyGoals.completed}</span>
                            <span className="text-muted">/ {weeklyGoals.total}</span>
                        </div>
                        <div className="progress-bg mt-sm">
                            <div className="progress-fill warning" style={{ width: weeklyGoals.total > 0 ? `${(weeklyGoals.completed / weeklyGoals.total) * 100}%` : '0%', backgroundColor: 'var(--warning-color)' }}></div>
                        </div>
                    </Card>

                    <Card glass padding="md">
                        <h4 className="mb-sm text-secondary font-medium">Monthly Goals</h4>
                        <div className="goal-summary-stats">
                            <span className="text-lg font-bold">{monthlyGoals.completed}</span>
                            <span className="text-muted">/ {monthlyGoals.total}</span>
                        </div>
                        <div className="progress-bg mt-sm">
                            <div className="progress-fill primary" style={{ width: monthlyGoals.total > 0 ? `${(monthlyGoals.completed / monthlyGoals.total) * 100}%` : '0%', backgroundColor: 'var(--primary-color)' }}></div>
                        </div>
                    </Card>
                </div>
            </div>

            {/* RIGHT COLUMN: Life Hubs */}
            <div className="dashboard-sidebar">
                {/* Finance Snapshot */}
                <Card glass padding="md" className="widget mb-md hoverable-widget">
                    <Link to="/finance" className="widget-click-target">
                        <div className="widget-header mb-sm">
                            <div className="widget-title-icon">
                                <WalletCards size={18} className="text-primary" />
                                <h3>Finance Snapshot</h3>
                            </div>
                        </div>
                        <div className="finance-mini-stats">
                            <div className="f-stat border-bottom pb-sm mb-sm">
                                <span className="text-secondary">Upcoming Bills (7d)</span>
                                <span className="font-bold text-danger">{currencySymbol}{finance.upcomingBills.toLocaleString()}</span>
                            </div>
                            <div className="f-stat border-bottom pb-sm mb-sm">
                                <span className="text-secondary">Total Savings</span>
                                <span className="font-bold text-success">{currencySymbol}{finance.savings.toLocaleString()}</span>
                            </div>
                            <div className="f-stat">
                                <span className="text-secondary">Total Invested</span>
                                <span className="font-bold text-primary">{currencySymbol}{finance.investments.toLocaleString()}</span>
                            </div>
                        </div>
                    </Link>
                </Card>

                {/* My Lists Preview */}
                <Card glass padding="md" className="widget mb-md hoverable-widget">
                    <Link to="/lists" className="widget-click-target">
                        <div className="widget-header mb-sm">
                            <div className="widget-title-icon">
                                <List size={18} className="text-secondary" />
                                <h3>My Lists</h3>
                            </div>
                        </div>
                        {userLists.length > 0 ? (
                            <div className="lists-mini-content" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {userLists.map(list => (
                                    <div key={list.id} className="list-mini-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                        {/* `user_lists.icon` stores the icon's NAME. This used to
                                            render the string itself, so the widget read
                                            "CheckSquare Things I want to buy". */}
                                        {React.createElement(listIcon(list.icon), {
                                            size: 16,
                                            className: 'text-secondary',
                                            style: { flexShrink: 0 }
                                        })}
                                        <span className="font-medium text-sm">{list.name}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-secondary text-sm mt-md">No lists created yet. Create one!</p>
                        )}
                    </Link>
                </Card>

                {/* Exercise This Week */}
                <Card glass padding="md" className="widget mb-md hoverable-widget">
                    <Link to="/exercise" className="widget-click-target">
                        <div className="widget-header mb-sm">
                            <div className="widget-title-icon">
                                <Activity size={18} className="text-success" />
                                <h3>Exercise This Week</h3>
                            </div>
                        </div>
                        <div className="exercise-mini-content">
                            <div className="exercise-big-stat">
                                {exerciseWeek.sessions} <span className="text-secondary text-sm">/ {exerciseWeek.target || 'No target'} sessions</span>
                            </div>
                            {exerciseWeek.target > 0 && (
                                <div className="progress-bg mt-sm">
                                    <div className="progress-fill" style={{ width: `${Math.min(100, (exerciseWeek.sessions / exerciseWeek.target) * 100)}%`, backgroundColor: 'var(--success-color)' }}></div>
                                </div>
                            )}
                        </div>
                    </Link>
                </Card>

                {/* Currently Reading */}
                {currentBook ? (
                    <Card glass padding="none" className="widget hoverable-widget overflow-hidden">
                        <Link to="/books" className="widget-click-target p-md" style={{ display: 'block' }}>
                            <div className="widget-header mb-md">
                                <div className="widget-title-icon">
                                    <BookOpen size={18} className="text-warning" />
                                    <h3>Currently Reading</h3>
                                </div>
                            </div>
                            <div className="reading-mini-content">
                                {currentBook.cover_image ? (
                                    <img src={currentBook.cover_image} alt={currentBook.title} className="reading-mini-cover" />
                                ) : (
                                    <div className="reading-mini-cover" style={{ backgroundColor: 'var(--surface-hover)' }}></div>
                                )}
                                <div>
                                    <h4 className="book-title">{currentBook.title}</h4>
                                    <p className="book-author text-secondary">{currentBook.author}</p>
                                </div>
                            </div>
                        </Link>
                    </Card>
                ) : (
                    <Card glass padding="md" className="widget hoverable-widget">
                        <Link to="/books" className="widget-click-target">
                            <div className="widget-header mb-sm">
                                <div className="widget-title-icon">
                                    <BookOpen size={18} className="text-warning" />
                                    <h3>Currently Reading</h3>
                                </div>
                            </div>
                            <p className="text-secondary text-sm mt-md">Not reading any books right now. Discover your next read!</p>
                        </Link>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default DashboardView;
