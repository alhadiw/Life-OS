import React, { useState, useEffect } from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
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
                        dueDate: t.due_date
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

    const toggleTaskCompletion = async (task: Task) => {
        const newCompletedStatus = !task.completed;

        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompletedStatus } : t));

        if (newCompletedStatus) {
            await addPoints(task.points, `Completed ${task.tier} task: ${task.title}`);
        } else {
            await removePoints(task.points, `Unchecked ${task.tier} task: ${task.title}`);
        }

        try {
            if (task.tier === 'daily') {
                await supabase.from('tasks').update({ completed: newCompletedStatus }).eq('id', task.id);
            } else {
                await supabase.from('goals').update({ completed: newCompletedStatus }).eq('id', task.id);
            }
        } catch (error) {
            console.error('Error updating task:', error);
            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
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
                const today = new Date();
                let targetDate = new Date();

                if (activeTab === 'weekly') {
                    const day = today.getDay();
                    const diff = today.getDate() - day + (day === 0 ? -6 : 1) + 6; // Sunday
                    targetDate.setDate(diff);
                } else if (activeTab === 'monthly') {
                    targetDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); // Month End
                }

                const { data, error } = await supabase.from('goals').insert({
                    user_id: user.id, title: newTask.title, points: newTask.points,
                    category: newTask.category, period: activeTab, target_date: targetDate.toISOString().split('T')[0]
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
                    <div className="text-center py-xl text-muted">Loading {activeTab}s...</div>
                ) : (
                    <>
                        {uncompletedTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                onToggle={() => toggleTaskCompletion(task)}
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
                                        onToggle={() => toggleTaskCompletion(task)}
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
    onToggle: () => void,
    onEdit: () => void,
    onDelete: () => void,
    isCompleted?: boolean
}> = ({ task, onToggle, onEdit, onDelete, isCompleted }) => {
    return (
        <Card hoverable padding="sm" className={`task-card mb-sm ${isCompleted ? 'completed' : ''}`}>
            <div className="task-card-inner">
                <button
                    className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
                    onClick={onToggle}
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
