import React, { useState, useEffect } from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { todayISO, addDays, startOfWeekISO, endOfMonthISO } from '../../lib/dates';
import { celebrate, originFromElement, type CelebrationOrigin } from '../../lib/celebrate';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Plus, Check, CheckSquare, Trash2, Edit2 } from 'lucide-react';
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

const TasksView: React.FC = () => {
    const { addPoints, removePoints } = usePoints();
    const { user } = useAuth();
    const toast = useToast();

    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeTab, setActiveTab] = useState<TaskTier>('daily');
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [newTask, setNewTask] = useState({ title: '', points: 50, category: 'Personal' });

    // Edit state
    const [editingTask, setEditingTask] = useState<Task | null>(null);

    useEffect(() => {
        if (user) {
            fetchTasks(activeTab);
        }
    }, [user, activeTab]);

    const fetchTasks = async (tier: TaskTier) => {
        setLoading(true);
        try {
            if (tier === 'daily') {
                const { data, error } = await supabase
                    .from('tasks')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (data) {
                    setTasks(data.map(t => ({
                        id: t.id,
                        title: t.title,
                        points: t.points,
                        category: t.category || 'General',
                        tier: 'daily',
                        completed: t.completed,
                        dueDate: t.due_date ?? undefined
                    })));
                }
            } else {
                const { data, error } = await supabase
                    .from('goals')
                    .select('*')
                    .eq('period', tier)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (data) {
                    setTasks(data.map(g => ({
                        id: g.id,
                        title: g.title,
                        points: g.points,
                        category: g.category || 'General',
                        tier: g.period as TaskTier,
                        completed: g.completed,
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
        const newCompletedStatus = !task.completed;

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompletedStatus } : t));

        // Persist the checkbox first. This used to award the points *before*
        // the update and then, on failure, revert only the checkbox — leaving
        // the ledger paying out for a task the database still had as open.
        const table = task.tier === 'daily' ? 'tasks' : 'goals';
        const { error } = await supabase
            .from(table)
            .update({ completed: newCompletedStatus })
            .eq('id', task.id);

        if (error) {
            console.error('Error updating task:', error);
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
            toast.error("Couldn't save that — your points are unchanged.");
            return;
        }

        if (newCompletedStatus) {
            // MOT-4. Fires only after the update above came back clean, for the
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
                    category: newTask.category
                }).select().single();

                if (error) throw error;
                if (data) {
                    const task: Task = {
                        id: data.id, title: data.title, points: data.points,
                        category: data.category || 'General', tier: 'daily', completed: false
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

            setNewTask({ title: '', points: activeTab === 'daily' ? 25 : activeTab === 'weekly' ? 200 : 1000, category: 'Personal' });
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
