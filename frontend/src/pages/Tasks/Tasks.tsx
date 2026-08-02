import React, { useState, useEffect } from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { todayISO, addDays, startOfWeekISO, startOfMonthISO, endOfMonthISO } from '../../lib/dates';
import { celebrate, originFromElement, type CelebrationOrigin } from '../../lib/celebrate';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Plus, Check, CheckSquare, Trash2, Edit2, Inbox, CalendarClock } from 'lucide-react';
import './Tasks.css';

type TaskTier = 'daily' | 'weekly' | 'monthly';

interface Task {
    id: string;
    title: string;
    points: number;
    category: string;
    tier: TaskTier;
    completed: boolean;
    dueDate?: string;
}

/**
 * ARCH-1 — the period a completion is filed under.
 *
 * Daily tasks are keyed on today's local date; a weekly goal on the Monday of
 * this week; a monthly goal on the 1st. "Completed" is then the existence of a
 * row with that key, which is why nothing has to be cleared on a schedule any
 * more.
 */
const periodKeyFor = (tier: TaskTier, today: string): string =>
    tier === 'daily' ? today
        : tier === 'weekly' ? startOfWeekISO(today)
            : startOfMonthISO(today);

const TasksView: React.FC = () => {
    const { addPoints, removePoints } = usePoints();
    const { user } = useAuth();
    const toast = useToast();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState<TaskTier>('daily');
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', points: 50, category: 'Personal', dueDate: '' });

    // TSK-3 — quick capture. One field, always on screen, no decisions.
    const [capture, setCapture] = useState('');
    const [inbox, setInbox] = useState<Task[]>([]);

    // Edit state
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    useEffect(() => {
        if (user) {
            fetchTasks(activeTab);
            fetchInbox();
        }
    }, [user, activeTab]);

    /** TSK-3 — untriaged captures, independent of the active tab. */
    const fetchInbox = async () => {
        const { data, error } = await supabase
            .from('tasks').select('*').eq('inbox', true)
            .order('created_at', { ascending: false });
        if (error) return;
        setInbox((data ?? []).map(t => ({
            id: t.id, title: t.title, points: t.points,
            category: t.category || 'General', tier: 'daily' as TaskTier,
            completed: false, dueDate: t.due_date ?? undefined
        })));
    };

    const fetchTasks = async (tier: TaskTier) => {
        setLoading(true);
        try {
            const today = todayISO();

            if (tier === 'daily') {
                // Two reads instead of one: the tasks, and which of them have a
                // completion row for today. `tasks.completed` is still in the
                // table (DESIGN.md §11 keeps it for a release) but is no longer
                // read — it is the column that used to be wiped nightly.
                const [{ data, error }, { data: comps, error: compError }] = await Promise.all([
                    supabase.from('tasks').select('*').eq('inbox', false)
                        .order('created_at', { ascending: false }),
                    supabase.from('task_completions').select('task_id').eq('local_date', today)
                ]);

                if (error) throw error;
                if (compError) throw compError;

                const done = new Set((comps ?? []).map(c => c.task_id));
                if (data) {
                    setTasks(data.map(t => ({
                        id: t.id,
                        title: t.title,
                        points: t.points,
                        category: t.category || 'General',
                        tier: 'daily',
                        completed: done.has(t.id),
                        dueDate: t.due_date ?? undefined
                    })));
                }
            } else {
                const periodStart = periodKeyFor(tier, today);
                const [{ data, error }, { data: comps, error: compError }] = await Promise.all([
                    supabase.from('goals').select('*').eq('period', tier)
                        .order('created_at', { ascending: false }),
                    supabase.from('goal_completions').select('goal_id').eq('period_start', periodStart)
                ]);

                if (error) throw error;
                if (compError) throw compError;

                const done = new Set((comps ?? []).map(c => c.goal_id));
                if (data) {
                    setTasks(data.map(g => ({
                        id: g.id,
                        title: g.title,
                        points: g.points,
                        category: g.category || 'General',
                        tier: g.period as TaskTier,
                        completed: done.has(g.id),
                        dueDate: g.target_date
                    })));
                }
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleTaskCompletion = async (task: Task, origin?: CelebrationOrigin) => {
        if (!user) return;
        const newCompletedStatus = !task.completed;
        const today = todayISO();
        const periodStart = periodKeyFor(task.tier, today);

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompletedStatus } : t));

        // ARCH-1 — completing writes a row, un-completing deletes it. There is no
        // boolean to flip and nothing to reset later, so the record of *when*
        // this was done survives instead of being cleared overnight.
        const error = newCompletedStatus
            ? (task.tier === 'daily'
                ? (await supabase.from('task_completions').insert({
                    user_id: user.id, task_id: task.id, local_date: periodStart, points_awarded: task.points
                })).error
                : (await supabase.from('goal_completions').insert({
                    user_id: user.id, goal_id: task.id, period_start: periodStart, points_awarded: task.points
                })).error)
            : (task.tier === 'daily'
                ? (await supabase.from('task_completions').delete()
                    .eq('task_id', task.id).eq('local_date', periodStart)).error
                : (await supabase.from('goal_completions').delete()
                    .eq('goal_id', task.id).eq('period_start', periodStart)).error);

        if (error) {
            console.error('Error updating task completion:', error);
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
            toast.error("Couldn't save that — your points are unchanged.");
            return;
        }

        if (newCompletedStatus) {
            // MOT-4. Fires only after the write above came back clean, for the
            // same reason the points do — confetti over a write that failed
            // would be celebrating something that didn't happen.
            celebrate(origin);
            await addPoints(task.points, `Completed ${task.tier} task: ${task.title}`);
        } else {
            await removePoints(task.points, `Unchecked ${task.tier} task: ${task.title}`);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTask.title.trim() || !user) return;

        try {
            if (activeTab === 'daily') {
                const { data, error } = await supabase.from('tasks').insert({
                    user_id: user.id,
                    title: newTask.title,
                    points: newTask.points,
                    category: newTask.category,
                    // TSK-4 — the column existed since day one and was never
                    // written, which is what left FIX-7's dashboard filter inert.
                    due_date: newTask.dueDate || null
                }).select().single();

                if (error) throw error;
                if (data) {
                    const task: Task = {
                        id: data.id, title: data.title, points: data.points,
                        category: data.category || 'General', tier: 'daily', completed: false,
                        dueDate: data.due_date ?? undefined
                    };
                    setTasks(prev => [task, ...prev]);
                }
            } else {
                // A weekly goal is due at the end of this week, a monthly one at
                // the end of this month — in the user's calendar (FIX-6). The
                // old day-of-month arithmetic here could roll into the wrong
                // month near a boundary.
                const today = todayISO();
                const targetDate = activeTab === 'weekly'
                    ? addDays(startOfWeekISO(today), 6)
                    : endOfMonthISO(today);

                const { data, error } = await supabase.from('goals').insert({
                    user_id: user.id, title: newTask.title, points: newTask.points,
                    category: newTask.category, period: activeTab, target_date: targetDate
                }).select().single();

                if (error) throw error;
                if (data) {
                    const goal: Task = {
                        id: data.id, title: data.title, points: data.points,
                        category: data.category || 'General', tier: data.period as TaskTier, completed: false
                    };
                    setTasks(prev => [goal, ...prev]);
                }
            }

            setNewTask({ title: '', points: activeTab === 'daily' ? 25 : activeTab === 'weekly' ? 200 : 1000, category: 'Personal', dueDate: '' });
            setShowForm(false);
        } catch (error) {
            console.error('Error creating task:', error);
        }
    };

    const handleUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask || !editingTask.title.trim()) return;

        try {
            if (editingTask.tier === 'daily') {
                await supabase.from('tasks').update({
                    title: editingTask.title,
                    points: editingTask.points,
                    category: editingTask.category
                }).eq('id', editingTask.id);
            } else {
                await supabase.from('goals').update({
                    title: editingTask.title,
                    points: editingTask.points,
                    category: editingTask.category
                }).eq('id', editingTask.id);
            }

            setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
            setEditingTask(null);
        } catch (error) {
            console.error('Error updating task:', error);
        }
    };

    const handleDeleteTask = async (task: Task) => {
        if (!window.confirm(`Are you sure you want to delete "${task.title}"?`)) return;

        try {
            if (task.tier === 'daily') {
                await supabase.from('tasks').delete().eq('id', task.id);
            } else {
                await supabase.from('goals').delete().eq('id', task.id);
            }

            setTasks(prev => prev.filter(t => t.id !== task.id));
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    /**
     * TSK-3 — capture and triage.
     *
     * An inbox item is a normal task row with `inbox = true`, so triage is a
     * flag flip rather than a copy between tables, and nothing else in the app
     * has to learn about a second kind of thing.
     */
    const handleCapture = async (e: React.FormEvent) => {
        e.preventDefault();
        const title = capture.trim();
        if (!title || !user) return;

        setCapture('');
        const { error } = await supabase.from('tasks').insert({
            user_id: user.id, title, inbox: true
        });

        if (error) {
            toast.error("Couldn't capture that — try again.");
            setCapture(title);
            return;
        }
        fetchInbox();
    };

    const triageItem = async (item: Task) => {
        const { error } = await supabase.from('tasks').update({ inbox: false }).eq('id', item.id);
        if (error) return toast.error("Couldn't move that out of the inbox.");
        setInbox(prev => prev.filter(i => i.id !== item.id));
        if (activeTab === 'daily') fetchTasks('daily');
        toast.success(`"${item.title}" moved to Daily Tasks.`);
    };

    const discardItem = async (item: Task) => {
        const { error } = await supabase.from('tasks').delete().eq('id', item.id);
        if (error) return toast.error("Couldn't delete that.");
        setInbox(prev => prev.filter(i => i.id !== item.id));
    };

    const handleTabChange = (tier: TaskTier) => {
        setActiveTab(tier);
        setNewTask(prev => ({
            ...prev,
            points: tier === 'daily' ? 25 : tier === 'weekly' ? 200 : 1000
        }));
        setShowForm(false);
    };

    const uncompletedTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    const pointsEarned = completedTasks.reduce((sum, t) => sum + t.points, 0);
    const pointsTotal = tasks.reduce((sum, t) => sum + t.points, 0);
    const progressPercent = pointsTotal > 0 ? (pointsEarned / pointsTotal) * 100 : 0;

    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Tasks & Goals</h2>
                    <p className="text-secondary mt-1">Earn points by completing your objectives.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> Add {activeTab === 'daily' ? 'Task' : 'Goal'}
                </Button>
            </div>

            {/* TSK-3 — always reachable, above the tabs, costs one field. */}
            <form onSubmit={handleCapture} className="capture-bar mb-md">
                <Inbox size={18} className="text-muted capture-icon" />
                <input
                    type="text"
                    className="capture-input"
                    placeholder="Capture anything — sort it out later…"
                    value={capture}
                    onChange={e => setCapture(e.target.value)}
                    aria-label="Quick capture"
                />
                {capture.trim() && <Button type="submit" variant="ghost">Add</Button>}
            </form>

            {inbox.length > 0 && (
                <Card glass className="mb-lg inbox-card">
                    <div className="inbox-head">
                        <h3><Inbox size={16} /> Inbox</h3>
                        <span className="text-secondary">{inbox.length} to triage</span>
                    </div>
                    <div className="inbox-items">
                        {inbox.map(item => (
                            <div key={item.id} className="inbox-item">
                                <span className="inbox-title">{item.title}</span>
                                <div className="inbox-actions">
                                    <Button variant="ghost" onClick={() => triageItem(item)}>
                                        Keep as task
                                    </Button>
                                    <button
                                        className="icon-btn hover-danger"
                                        title="Discard"
                                        onClick={() => discardItem(item)}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <div className="tabs mb-lg">
                <button className={`tab ${activeTab === 'daily' ? 'active' : ''}`} onClick={() => handleTabChange('daily')}>Daily Tasks</button>
                <button className={`tab ${activeTab === 'weekly' ? 'active' : ''}`} onClick={() => handleTabChange('weekly')}>Weekly Goals</button>
                <button className={`tab ${activeTab === 'monthly' ? 'active' : ''}`} onClick={() => handleTabChange('monthly')}>Monthly Goals</button>
            </div>

            {/* Earnings Summary */}
            <Card glass padding="md" className="mb-lg">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div className="text-secondary text-sm font-medium mb-1">
                                {activeTab === 'daily' ? "Today's" : activeTab === 'weekly' ? "This Week's" : "This Month's"} Earnings
                            </div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>
                                <span className="text-primary">{pointsEarned}</span>
                                <span className="text-muted" style={{ fontSize: '1.125rem' }}> / {pointsTotal} pts</span>
                            </div>
                        </div>
                        {pointsTotal > 0 && pointsEarned === pointsTotal && (
                            <div className="text-success font-bold text-sm animate-fade-in mb-1">All completed! 🎉</div>
                        )}
                    </div>
                    {pointsTotal > 0 && (
                        <div style={{ width: '100%', height: '8px', background: 'var(--surface-hover)', borderRadius: '4px', overflow: 'hidden', marginTop: '0.25rem' }}>
                            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s ease' }} />
                        </div>
                    )}
                </div>
            </Card>

            {showForm && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateTask} className="task-form">
                        <Input
                            label="Title" value={newTask.title}
                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                            placeholder={`What do you want to accomplish this ${activeTab === 'daily' ? 'day' : activeTab === 'weekly' ? 'week' : 'month'}?`}
                            autoFocus required
                        />
                        <div className="form-row">
                            <Input
                                type="number" label="Points Value" value={newTask.points}
                                onChange={e => setNewTask({ ...newTask, points: parseInt(e.target.value) || 0 })} required
                            />
                            <Input
                                label="Category" value={newTask.category}
                                onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                                placeholder="e.g. Health, Work, Personal"
                            />
                        </div>
                        {/* TSK-4 — only daily tasks carry a due date; goals get
                            their period's end date automatically. */}
                        {activeTab === 'daily' && (
                            <Input
                                type="date"
                                label="Due date (optional)"
                                value={newTask.dueDate}
                                onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                            />
                        )}
                        <div style={{ display: 'none' }}>
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Create {activeTab === 'daily' ? 'Task' : 'Goal'}</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="task-list">
                {loading ? (
                    <SkeletonList count={5} label={`Loading ${activeTab}s`} />
                ) : (
                    <>
                        {uncompletedTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onToggle={origin => toggleTaskCompletion(task, origin)}
                                onEdit={() => setEditingTask(task)}
                                onDelete={() => handleDeleteTask(task)}
                            />
                        ))}

                        {uncompletedTasks.length === 0 && !showForm && (
                            <div className="empty-state">
                                <CheckSquare size={48} className="text-muted mb-sm" />
                                <h3 className="mb-1">All Caught Up!</h3>
                                <p className="text-secondary">You've completed all your {activeTab}s.</p>
                                <Button variant="ghost" className="mt-md" onClick={() => setShowForm(true)}>Add more</Button>
                            </div>
                        )}

                        {completedTasks.length > 0 && (
                            <div className="completed-section mt-xl">
                                <h3 className="section-subtitle mb-md">Completed</h3>
                                {completedTasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onToggle={origin => toggleTaskCompletion(task, origin)}
                                        onEdit={() => setEditingTask(task)}
                                        onDelete={() => handleDeleteTask(task)}
                                        isCompleted
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Modal */}
            <Modal
                isOpen={!!editingTask}
                onClose={() => setEditingTask(null)}
                title={`Edit ${editingTask?.tier === 'daily' ? 'Task' : 'Goal'}`}
            >
                {editingTask && (
                    <form onSubmit={handleUpdateTask}>
                        <Input
                            label="Title"
                            value={editingTask.title}
                            onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                            required
                        />
                        <div className="form-row">
                            <Input
                                type="number"
                                label="Points Value"
                                value={editingTask.points}
                                onChange={e => setEditingTask({ ...editingTask, points: parseInt(e.target.value) || 0 })}
                                required
                            />
                            <Input
                                label="Category"
                                value={editingTask.category}
                                onChange={e => setEditingTask({ ...editingTask, category: e.target.value })}
                            />
                        </div>
                        <div className="form-actions">
                            <Button type="button" variant="ghost" onClick={() => setEditingTask(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

const TaskCard: React.FC<{
    task: Task,
    // The origin is where the confetti comes from (MOT-4) — the checkbox knows
    // its own position, and the page handler does not.
    onToggle: (origin?: CelebrationOrigin) => void,
    onEdit: () => void,
    onDelete: () => void,
    isCompleted?: boolean
}> = ({ task, onToggle, onEdit, onDelete, isCompleted }) => {
    return (
        <Card hoverable padding="sm" className={`task-card mb-sm ${isCompleted ? 'completed' : ''}`}>
            <div className="task-card-inner">
                <button
                    className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
                    onClick={e => onToggle(originFromElement(e.currentTarget))}
                    aria-label={isCompleted ? "Mark as uncompleted" : "Mark as completed"}
                >
                    {isCompleted && <Check size={16} strokeWidth={3} />}
                </button>

                <div className="task-details">
                    <h4 className="task-title">{task.title}</h4>
                    <div className="task-meta mt-1">
                        <span className="badge badge-neutral">{task.category}</span>
                        {/* TSK-4 — overdue surfacing. Only meaningful now that
                            something actually writes due_date. */}
                        {task.dueDate && !isCompleted && (
                            <span className={`badge due-badge ${task.dueDate < todayISO() ? 'overdue' : ''}`}>
                                <CalendarClock size={11} />
                                {task.dueDate < todayISO()
                                    ? 'Overdue'
                                    : task.dueDate === todayISO()
                                        ? 'Due today'
                                        : `Due ${task.dueDate.slice(5)}`}
                            </span>
                        )}
                    </div>
                </div>

                <div className="task-points-badge hidden-mobile">
                    <span className="points-value">+{task.points}</span>
                    <span className="points-label">pts</span>
                </div>

                <div className="task-actions">
                    <button className="icon-btn" onClick={e => { e.stopPropagation(); onEdit(); }} aria-label="Edit task">
                        <Edit2 size={16} />
                    </button>
                    <button className="icon-btn hover-danger" onClick={e => { e.stopPropagation(); onDelete(); }} aria-label="Delete task">
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default TasksView;
