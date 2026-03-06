import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Check, WalletCards, BookOpen, Activity, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Dashboard.css';

const DashboardView: React.FC = () => {
    const { addPoints, removePoints, currencySymbol } = usePoints();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);

    const [quickTaskText, setQuickTaskText] = useState('');
    const [dailyTasks, setDailyTasks] = useState<any[]>([]);

    // Aggregated state
    const [weeklyGoals, setWeeklyGoals] = useState({ completed: 0, total: 0 });
    const [monthlyGoals, setMonthlyGoals] = useState({ completed: 0, total: 0 });
    const [finance, setFinance] = useState({ upcomingBills: 0, savings: 0, investments: 0 });
    const [currentBook, setCurrentBook] = useState<any>(null);
    const [exerciseWeek, setExerciseWeek] = useState({ sessions: 0, target: 0 });

    useEffect(() => {
        if (user) fetchDashboardData();
    }, [user]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Today's Tasks
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (tasksData) {
                // Filter tasks to only show uncompleted or completed today (for simplicity, we'll just show them all in the quick view like before)
                setDailyTasks(tasksData.map(t => ({ id: t.id, title: t.title, points: t.points, completed: t.completed })));
            }

            // 2. Fetch Goals Summary
            const { data: goalsData } = await supabase.from('goals').select('period, completed');
            if (goalsData) {
                const weekly = goalsData.filter(g => g.period === 'weekly');
                const monthly = goalsData.filter(g => g.period === 'monthly');
                setWeeklyGoals({ total: weekly.length, completed: weekly.filter(g => g.completed).length });
                setMonthlyGoals({ total: monthly.length, completed: monthly.filter(g => g.completed).length });
            }

            // 3. Fetch Finance Snapshot
            // Bills: Unpaid and due within 7 days
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);

            const { data: billsData } = await supabase
                .from('finance_bills')
                .select('amount, due_date')
                .eq('paid', false)
                .lte('due_date', nextWeek.toISOString().split('T')[0])
                .gte('due_date', today.toISOString().split('T')[0]);

            // Savings
            const { data: savingsData } = await supabase.from('finance_savings').select('current_amount');
            // Investments
            const { data: invData } = await supabase.from('finance_investments').select('amount');

            setFinance({
                upcomingBills: billsData ? billsData.reduce((sum, b) => sum + Number(b.amount), 0) : 0,
                savings: savingsData ? savingsData.reduce((sum, s) => sum + Number(s.current_amount), 0) : 0,
                investments: invData ? invData.reduce((sum, i) => sum + Number(i.amount), 0) : 0
            });

            // 4. Fetch Currently Reading
            const { data: bookData } = await supabase
                .from('books')
                .select('title, author, cover_image')
                .eq('status', 'reading')
                .limit(1)
                .single();
            if (bookData) setCurrentBook(bookData);

            // 5. Fetch Exercise
            const { data: workoutsThisWeek } = await supabase
                .from('exercises')
                .select('id')
                // A complete app would filter by current week, simplified here
                .limit(10);

            const { data: exGoals } = await supabase
                .from('exercise_goals')
                .select('target_value')
                .eq('period', 'weekly')
                .limit(1)
                .single();

            setExerciseWeek({
                sessions: workoutsThisWeek?.length || 0,
                target: exGoals ? exGoals.target_value : 0
            });

        } catch (error) {
            console.error('Error fetching dashboard summary:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- HANDLERS ---
    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !quickTaskText.trim()) return;

        try {
            const { data, error } = await supabase.from('tasks').insert({
                user_id: user.id,
                title: quickTaskText,
                points: 25,
                category: 'General',
                completed: false
            }).select().single();

            if (error) throw error;
            if (data) {
                setDailyTasks([{ id: data.id, title: data.title, points: data.points, completed: data.completed }, ...dailyTasks]);
            }
            setQuickTaskText('');
        } catch (e) {
            console.error(e);
        }
    };

    const toggleTask = async (task: any) => {
        const newCompletedStatus = !task.completed;

        setDailyTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompletedStatus } : t));

        if (newCompletedStatus) {
            await addPoints(task.points, `Quick completed: ${task.title}`);
        } else {
            await removePoints(task.points, `Unchecked: ${task.title}`);
        }

        try {
            await supabase.from('tasks').update({ completed: newCompletedStatus }).eq('id', task.id);
        } catch (e) {
            console.error(e);
        }
    };

    if (loading) {
        return <div className="animate-fade-in p-xl text-center text-secondary">Loading your dashboard...</div>;
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
                                        onClick={() => toggleTask(task)}
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
