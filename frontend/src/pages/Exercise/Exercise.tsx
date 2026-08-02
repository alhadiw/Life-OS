import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonGrid, SkeletonList } from '../../components/ui/Skeleton';
import { celebrate, originFromElement, type CelebrationOrigin } from '../../lib/celebrate';
import { Activity, Flame, Timer, Calendar, Plus, Check, Target, Trash2, Edit2 } from 'lucide-react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { useQuery, fromSupabase, invalidate, setQueryData } from '../../hooks/useQuery';
import { todayISO, addDays } from '../../lib/dates';
import './Exercise.css';

type WorkoutIntensity = 'Light' | 'Moderate' | 'Intense';

interface Workout {
    id: string;
    type: string;
    durationMinutes: number;
    date: string;
    intensity?: WorkoutIntensity;
    notes?: string;
}

interface ExerciseGoal {
    id: string;
    title: string;
    period: 'weekly' | 'monthly';
    targetValue: number;
    currentValue: number;
    metric: 'sessions' | 'minutes';
    completed: boolean;
    pointsReward: number;
}

const ExerciseView: React.FC = () => {
    const { addPoints } = usePoints();
    const { user } = useAuth();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState<'log' | 'goals'>('log');
    const [showForm, setShowForm] = useState(false);

    // Create forms state
    const [newWorkout, setNewWorkout] = useState({ type: '', durationMinutes: 30, date: todayISO(), intensity: 'Moderate' as WorkoutIntensity, notes: '' });
    const [newGoal, setNewGoal] = useState({ title: '', period: 'weekly' as 'weekly' | 'monthly', targetValue: 3, metric: 'sessions' as 'sessions' | 'minutes', pointsReward: 100 });

    // Edit state
    const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null);
    const [editingGoal, setEditingGoal] = useState<ExerciseGoal | null>(null);

    // ARCH-3 — both tabs are separate cached queries, so switching tabs no
    // longer refetches the one you just left.
    const workoutsQ = useQuery<Workout[]>(user ? 'exercise:workouts' : null, async () => {
        const rows = await fromSupabase(
            supabase.from('exercises').select('*').order('exercise_date', { ascending: false })
        );
        return rows.map(w => ({
            id: w.id, type: w.type, durationMinutes: w.duration_minutes,
            date: w.exercise_date, intensity: w.intensity ?? undefined, notes: w.notes ?? undefined
        }));
    });

    const goalsQ = useQuery<ExerciseGoal[]>(user ? 'exercise:goals' : null, async () => {
        const rows = await fromSupabase(
            supabase.from('exercise_goals').select('*').order('created_at', { ascending: false })
        );
        return rows.map(g => ({
            id: g.id, title: g.title, period: g.period as 'weekly' | 'monthly',
            targetValue: g.target_value, currentValue: g.current_value,
            metric: g.metric as 'sessions' | 'minutes', completed: g.completed, pointsReward: g.points_reward
        }));
    });

    const workouts = workoutsQ.data ?? [];
    const goals = goalsQ.data ?? [];
    const loading = activeTab === 'log' ? workoutsQ.loading : goalsQ.loading;

    // --- Create Actions ---
    const handleLogWorkout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newWorkout.type.trim()) return;

        try {
            const { data, error } = await supabase.from('exercises').insert({
                user_id: user.id, type: newWorkout.type, duration_minutes: newWorkout.durationMinutes,
                exercise_date: newWorkout.date, intensity: newWorkout.intensity, notes: newWorkout.notes
            }).select().single();
            if (error) throw error;
            if (data) {
                invalidate('exercise:workouts');
            }
            setShowForm(false);
            setNewWorkout({ type: '', durationMinutes: 30, date: todayISO(), intensity: 'Moderate', notes: '' });
        } catch (e) { console.error(e); }
    };

    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !newGoal.title.trim()) return;

        try {
            const { data, error } = await supabase.from('exercise_goals').insert({
                user_id: user.id, title: newGoal.title, period: newGoal.period, target_value: newGoal.targetValue,
                current_value: 0, metric: newGoal.metric, completed: false, points_reward: newGoal.pointsReward
            }).select().single();

            if (error) throw error;
            if (data) {
                invalidate('exercise:goals');
            }
            setShowForm(false);
            setNewGoal({ title: '', period: 'weekly', targetValue: 3, metric: 'sessions', pointsReward: 100 });
        } catch (e) { console.error(e); }
    };

    const completeGoal = async (goal: ExerciseGoal, origin?: CelebrationOrigin) => {
        if (goal.completed) return;

        // Optimistic through the cache so anything else reading this query moves
        // with it; on failure we re-read rather than reconstruct.
        setQueryData<ExerciseGoal[]>('exercise:goals', prev => (prev ?? []).map(g =>
            g.id === goal.id ? { ...g, completed: true, currentValue: g.targetValue } : g));

        // This used to award the points first and wrap the write in a try/catch
        // — which caught nothing, because supabase-js resolves with an `error`
        // property rather than throwing. A failed update therefore paid out
        // silently. Same ordering as Tasks and Dashboard now: persist, verify,
        // then reward.
        const { error } = await supabase
            .from('exercise_goals')
            .update({ completed: true, current_value: goal.targetValue })
            .eq('id', goal.id);

        if (error) {
            console.error('Error completing exercise goal:', error);
            invalidate('exercise:goals');
            toast.error("Couldn't save that — your points are unchanged.");
            return;
        }

        invalidate('exercise:goals');
        celebrate(origin); // MOT-4
        await addPoints(goal.pointsReward, `Exercise Goal Met: ${goal.title}`);
    };

    // --- Edit Actions ---
    const handleUpdateWorkout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingWorkout || !editingWorkout.type.trim()) return;

        try {
            await supabase.from('exercises').update({
                type: editingWorkout.type, duration_minutes: editingWorkout.durationMinutes,
                exercise_date: editingWorkout.date, intensity: editingWorkout.intensity, notes: editingWorkout.notes
            }).eq('id', editingWorkout.id);
            invalidate('exercise:workouts');
            setEditingWorkout(null);
        } catch (e) { console.error(e); }
    };

    const handleUpdateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGoal || !editingGoal.title.trim()) return;

        try {
            await supabase.from('exercise_goals').update({
                title: editingGoal.title, period: editingGoal.period, target_value: editingGoal.targetValue,
                metric: editingGoal.metric, points_reward: editingGoal.pointsReward
            }).eq('id', editingGoal.id);
            invalidate('exercise:goals');
            setEditingGoal(null);
        } catch (e) { console.error(e); }
    };

    // --- Delete Actions ---
    const handleDeleteWorkout = async (w: Workout) => {
        if (!window.confirm(`Are you sure you want to delete this ${w.type} workout?`)) return;
        try {
            await supabase.from('exercises').delete().eq('id', w.id);
            invalidate('exercise:workouts');
        } catch (e) { console.error(e); }
    };

    const handleDeleteGoal = async (g: ExerciseGoal) => {
        if (!window.confirm(`Are you sure you want to delete goal "${g.title}"?`)) return;
        try {
            await supabase.from('exercise_goals').delete().eq('id', g.id);
            invalidate('exercise:goals');
        } catch (e) { console.error(e); }
    };

    const totalWorkouts = workouts.length;
    const totalMinutes = workouts.reduce((acc, w) => acc + w.durationMinutes, 0);

    const calculateStreak = () => {
        if (!workouts.length) return 0;

        // Workout dates are stored as plain `date` values, so comparing the ISO
        // strings directly is exact — no Date objects, no timezone to get wrong
        // (FIX-6: this used to walk backwards using UTC days, which shifted the
        // whole streak by one for anyone west of Greenwich late in the evening).
        const loggedDays = new Set(workouts.map(w => w.date));

        const today = todayISO();
        const yesterday = addDays(today, -1);

        // Today not being logged yet doesn't break a streak — the day isn't
        // over. Two consecutive missed days does.
        let cursor = loggedDays.has(today) ? today
            : loggedDays.has(yesterday) ? yesterday
                : null;

        if (cursor === null) return 0;

        let streak = 0;
        while (loggedDays.has(cursor)) {
            streak++;
            cursor = addDays(cursor, -1);
        }

        return streak;
    };

    const currentStreak = calculateStreak();

    return (
        <div className="animate-fade-in">
            <div className="page-header mb-lg">
                <div>
                    <h2>Exercise Tracker</h2>
                    <p className="text-secondary mt-1">Log workouts and hit your fitness goals.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    <Plus size={18} /> {activeTab === 'log' ? 'Log Workout' : 'New Goal'}
                </Button>
            </div>

            <div className="exercise-stats mb-xl">
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-primary-light"><Activity size={24} className="text-primary" /></div>
                    <div>
                        <div className="stat-label">Total Workouts</div>
                        <div className="stat-value">{totalWorkouts}</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-warning-light"><Timer size={24} className="text-warning" /></div>
                    <div>
                        <div className="stat-label">Total Minutes</div>
                        <div className="stat-value">{totalMinutes}</div>
                    </div>
                </Card>
                <Card glass padding="md" className="stat-card">
                    <div className="stat-icon bg-danger-light"><Flame size={24} className="text-danger" /></div>
                    <div>
                        <div className="stat-label">Current Streak</div>
                        <div className="stat-value">{currentStreak} {currentStreak === 1 ? 'Day' : 'Days'}</div>
                    </div>
                </Card>
            </div>

            <div className="tabs mb-lg">
                <button className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => { setActiveTab('log'); setShowForm(false); }}>Workout Log</button>
                <button className={`tab ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => { setActiveTab('goals'); setShowForm(false); }}>Exercise Goals</button>
            </div>

            {/* Forms */}
            {showForm && activeTab === 'log' && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleLogWorkout} className="task-form">
                        <div className="form-row">
                            <Input label="Workout Type" value={newWorkout.type} onChange={e => setNewWorkout({ ...newWorkout, type: e.target.value })} autoFocus required placeholder="Running, Yoga..." />
                            <Input type="number" label="Duration (Minutes)" value={newWorkout.durationMinutes} onChange={e => setNewWorkout({ ...newWorkout, durationMinutes: Number(e.target.value) })} required />
                        </div>
                        <div className="form-row">
                            <Input type="date" label="Date" value={newWorkout.date} onChange={e => setNewWorkout({ ...newWorkout, date: e.target.value })} required />
                            <div className="input-group">
                                <label className="input-label">Intensity</label>
                                <select className="input-field" value={newWorkout.intensity} onChange={e => setNewWorkout({ ...newWorkout, intensity: e.target.value as WorkoutIntensity })}>
                                    <option value="Light">Light</option>
                                    <option value="Moderate">Moderate</option>
                                    <option value="Intense">Intense</option>
                                </select>
                            </div>
                        </div>
                        <Input label="Notes (Optional)" value={newWorkout.notes} onChange={e => setNewWorkout({ ...newWorkout, notes: e.target.value })} />
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Log Workout</Button>
                        </div>
                    </form>
                </Card>
            )}

            {showForm && activeTab === 'goals' && (
                <Card glass className="mb-lg">
                    <form onSubmit={handleCreateGoal} className="task-form">
                        <Input label="Goal Title" value={newGoal.title} onChange={e => setNewGoal({ ...newGoal, title: e.target.value })} autoFocus required placeholder="Run 3 times this week" />
                        <div className="form-row">
                            <div className="input-group">
                                <label className="input-label">Period</label>
                                <select className="input-field" value={newGoal.period} onChange={e => setNewGoal({ ...newGoal, period: e.target.value as 'weekly' | 'monthly' })}>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Metric</label>
                                <select className="input-field" value={newGoal.metric} onChange={e => setNewGoal({ ...newGoal, metric: e.target.value as 'sessions' | 'minutes' })}>
                                    <option value="sessions">Sessions</option>
                                    <option value="minutes">Minutes</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <Input type="number" label="Target Value" value={newGoal.targetValue} onChange={e => setNewGoal({ ...newGoal, targetValue: Number(e.target.value) })} required />
                            <Input type="number" label="Points Reward" value={newGoal.pointsReward} onChange={e => setNewGoal({ ...newGoal, pointsReward: Number(e.target.value) })} required />
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
                            <Button type="submit">Create Goal</Button>
                        </div>
                    </form>
                </Card>
            )}

            {activeTab === 'log' && (
                <div className="workout-list">
                    {loading && <SkeletonList count={4} label="Loading workouts" />}
                    {!loading && workouts.map(workout => (
                        <Card key={workout.id} hoverable padding="md" className="workout-card mb-md">
                            <div className="workout-header">
                                <div className="workout-title-group">
                                    <div className="workout-icon">
                                        <Activity size={20} />
                                    </div>
                                    <div>
                                        <h4 className="workout-title">{workout.type}</h4>
                                        <span className="workout-date"><Calendar size={14} /> {workout.date}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                                    <div className="workout-duration">
                                        <Timer size={18} /> {workout.durationMinutes} min
                                    </div>
                                    <div className="exercise-actions">
                                        <button className="icon-btn" onClick={() => setEditingWorkout(workout)}><Edit2 size={16} /></button>
                                        <button className="icon-btn hover-danger" onClick={() => handleDeleteWorkout(workout)}><Trash2 size={16} /></button>
                                    </div>
                                </div>
                            </div>
                            <div className="workout-body mt-md">
                                {workout.intensity && (
                                    <span className={`badge ${workout.intensity === 'Light' ? 'badge-success' : workout.intensity === 'Moderate' ? 'badge-warning' : 'badge-danger'}`}>
                                        {workout.intensity}
                                    </span>
                                )}
                                {workout.notes && <p className="workout-notes mt-2 text-secondary">{workout.notes}</p>}
                            </div>
                        </Card>
                    ))}
                    {!loading && workouts.length === 0 && !showForm && (
                        <div className="empty-state">
                            <Activity size={48} className="text-muted mb-sm" />
                            <p>No workouts logged yet.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'goals' && (
                <div className="goals-grid">
                    {loading && <SkeletonGrid count={4} height="190px" label="Loading goals" />}
                    {!loading && goals.map(goal => {
                        const percent = Math.min(100, (goal.currentValue / goal.targetValue) * 100);
                        return (
                            <Card key={goal.id} padding="md" glass hoverable className={`goal-card ${goal.completed ? 'completed' : ''}`}>
                                <div className="goal-header">
                                    <div className="goal-title-wrapper">
                                        <Target size={20} className={goal.completed ? 'text-success' : 'text-primary'} />
                                        <h4>{goal.title}</h4>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {goal.completed && <span className="badge badge-success">Completed</span>}
                                        <div className="exercise-actions">
                                            <button className="icon-btn" onClick={() => setEditingGoal(goal)}><Edit2 size={16} /></button>
                                            <button className="icon-btn hover-danger" onClick={() => handleDeleteGoal(goal)}><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                </div>

                                <div className="goal-progress-section mt-md">
                                    <div className="goal-stats">
                                        <span className="current font-heading text-lg font-bold">{goal.currentValue}</span>
                                        <span className="target text-muted">/ {goal.targetValue} {goal.metric}</span>
                                    </div>
                                    <div className="progress-bg mt-sm mb-md">
                                        <div className={`progress-fill ${goal.completed ? 'success' : ''}`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>

                                <div className="goal-footer mt-auto">
                                    <div className="goal-reward tooltip" title="Reward for completion">
                                        <Flame size={16} className="text-warning" />
                                        <span className="text-warning font-semibold">+{goal.pointsReward} pts</span>
                                    </div>
                                    {!goal.completed && (
                                        <Button size="sm" variant={percent >= 100 ? 'primary' : 'secondary'} onClick={e => completeGoal(goal, originFromElement(e.currentTarget))}>
                                            <Check size={16} /> Mark Complete
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Edit Modals */}
            <Modal isOpen={!!editingWorkout} onClose={() => setEditingWorkout(null)} title="Edit Workout">
                {editingWorkout && (
                    <form onSubmit={handleUpdateWorkout}>
                        <div className="form-row">
                            <Input label="Workout Type" value={editingWorkout.type} onChange={e => setEditingWorkout({ ...editingWorkout, type: e.target.value })} required />
                            <Input type="number" label="Duration (Minutes)" value={editingWorkout.durationMinutes} onChange={e => setEditingWorkout({ ...editingWorkout, durationMinutes: Number(e.target.value) })} required />
                        </div>
                        <div className="form-row">
                            <Input type="date" label="Date" value={editingWorkout.date} onChange={e => setEditingWorkout({ ...editingWorkout, date: e.target.value })} required />
                            <div className="input-group">
                                <label className="input-label">Intensity</label>
                                <select className="input-field" value={editingWorkout.intensity} onChange={e => setEditingWorkout({ ...editingWorkout, intensity: e.target.value as WorkoutIntensity })}>
                                    <option value="Light">Light</option>
                                    <option value="Moderate">Moderate</option>
                                    <option value="Intense">Intense</option>
                                </select>
                            </div>
                        </div>
                        <Input label="Notes" value={editingWorkout.notes || ''} onChange={e => setEditingWorkout({ ...editingWorkout, notes: e.target.value })} />
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingWorkout(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>

            <Modal isOpen={!!editingGoal} onClose={() => setEditingGoal(null)} title="Edit Goal">
                {editingGoal && (
                    <form onSubmit={handleUpdateGoal}>
                        <Input label="Goal Title" value={editingGoal.title} onChange={e => setEditingGoal({ ...editingGoal, title: e.target.value })} required />
                        <div className="form-row">
                            <div className="input-group">
                                <label className="input-label">Period</label>
                                <select className="input-field" value={editingGoal.period} onChange={e => setEditingGoal({ ...editingGoal, period: e.target.value as 'weekly' | 'monthly' })}>
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Metric</label>
                                <select className="input-field" value={editingGoal.metric} onChange={e => setEditingGoal({ ...editingGoal, metric: e.target.value as 'sessions' | 'minutes' })}>
                                    <option value="sessions">Sessions</option>
                                    <option value="minutes">Minutes</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <Input type="number" label="Target Value" value={editingGoal.targetValue} onChange={e => setEditingGoal({ ...editingGoal, targetValue: Number(e.target.value) })} required />
                            <Input type="number" label="Points Reward" value={editingGoal.pointsReward} onChange={e => setEditingGoal({ ...editingGoal, pointsReward: Number(e.target.value) })} required />
                        </div>
                        <div className="form-actions mt-md">
                            <Button type="button" variant="ghost" onClick={() => setEditingGoal(null)}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </div>
                    </form>
                )}
            </Modal>
        </div>
    );
};

export default ExerciseView;
