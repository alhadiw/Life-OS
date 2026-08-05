import React, { useMemo, useState } from 'react';
import { usePoints } from '../../contexts/PointsContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useQuery, fromSupabase, invalidate } from '../../hooks/useQuery';
import { addDays, todayISO } from '../../lib/dates';
import {
    WEEKDAY_LABELS,
    completionRate,
    computeStreak,
    freezesUsedInMonth,
    isDueOn,
    weeklyProgress,
    type Habit
} from '../../lib/habits';
import { celebrate, originFromElement, type CelebrationOrigin } from '../../lib/celebrate';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { SkeletonList } from '../../components/ui/Skeleton';
import { Heatmap } from '../../components/Heatmap';
import { MonthCalendar } from '../../components/MonthCalendar';
import { Plus, Check, Flame, Snowflake, Trash2, Edit2, Archive, ArchiveRestore, ChevronDown } from 'lucide-react';
import './Habits.css';

/**
 * HAB-1..4 and HAB-6 — the Habits module.
 *
 * The distinction that makes this worth a separate page: a task is something you
 * finish, a habit is something you keep doing. `tasks` used to stand in for both
 * and lost its history nightly, which is why streaks and heatmaps were
 * impossible before ARCH-1.
 */

/** How far back the heatmaps and rate stats look. 53 whole weeks. */
const WINDOW_DAYS = 371;

const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];

type ScheduleKind = Habit['schedule_kind'];

interface HabitFormState {
    title: string;
    points: number;
    category: string;
    color: string;
    scheduleKind: ScheduleKind;
    weekdays: number[];
    timesPerWeek: number;
    intervalDays: number;
    freezeBudget: number;
}

const emptyForm = (): HabitFormState => ({
    title: '',
    points: 10,
    category: 'Personal',
    color: COLORS[0],
    scheduleKind: 'daily',
    weekdays: [1, 2, 3, 4, 5],
    timesPerWeek: 3,
    intervalDays: 2,
    freezeBudget: 2
});

const HabitsView: React.FC = () => {
    const { addPoints, removePoints } = usePoints();
    const { user } = useAuth();
    const toast = useToast();

    const today = todayISO();
    const windowStart = addDays(today, -(WINDOW_DAYS - 1));

    const [tab, setTab] = useState<'active' | 'archived'>('active');
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [form, setForm] = useState<HabitFormState>(emptyForm);
    const [expanded, setExpanded] = useState<string | null>(null);

    // ARCH-3 — three shared queries instead of three hand-rolled useEffect
    // blocks. Any write below calls invalidate('habits'), which refreshes all of
    // them together and keeps the Dashboard's copy honest too.
    const habitsQ = useQuery<Habit[]>(
        user ? 'habits' : null,
        () => fromSupabase(supabase.from('habits').select('*').order('created_at', { ascending: true }))
    );

    const completionsQ = useQuery<{ habit_id: string; local_date: string }[]>(
        user ? `habits:completions:${windowStart}` : null,
        () => fromSupabase(
            supabase.from('habit_completions')
                .select('habit_id, local_date')
                .gte('local_date', windowStart)
        )
    );

    const freezesQ = useQuery<{ habit_id: string; local_date: string }[]>(
        user ? `habits:freezes:${windowStart}` : null,
        () => fromSupabase(
            supabase.from('habit_freezes')
                .select('habit_id, local_date')
                .gte('local_date', windowStart)
        )
    );

    const habits = useMemo(() => habitsQ.data ?? [], [habitsQ.data]);

    /** habit_id -> set of ISO dates. Built once per data change, not per card. */
    const completionsByHabit = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const row of completionsQ.data ?? []) {
            let set = map.get(row.habit_id);
            if (!set) map.set(row.habit_id, (set = new Set()));
            set.add(row.local_date);
        }
        return map;
    }, [completionsQ.data]);

    const freezesByHabit = useMemo(() => {
        const map = new Map<string, Set<string>>();
        for (const row of freezesQ.data ?? []) {
            let set = map.get(row.habit_id);
            if (!set) map.set(row.habit_id, (set = new Set()));
            set.add(row.local_date);
        }
        return map;
    }, [freezesQ.data]);

    /** Overall heatmap: how many habits were completed on each day. */
    const overallValues = useMemo(() => {
        const map = new Map<string, number>();
        for (const row of completionsQ.data ?? []) {
            map.set(row.local_date, (map.get(row.local_date) ?? 0) + 1);
        }
        return map;
    }, [completionsQ.data]);

    const activeCount = habits.filter(h => !h.archived).length;
    const visible = habits.filter(h => (tab === 'archived' ? h.archived : !h.archived));
    const loading = habitsQ.loading || completionsQ.loading || freezesQ.loading;

    // ---------------------------------------------------------------------
    // Completion (ARCH-1: a row exists, or it doesn't)
    // ---------------------------------------------------------------------
    const toggleToday = async (habit: Habit, origin?: CelebrationOrigin) => {
        if (!user) return;
        const done = completionsByHabit.get(habit.id)?.has(today) ?? false;

        if (done) {
            const { error } = await supabase
                .from('habit_completions')
                .delete()
                .eq('habit_id', habit.id)
                .eq('local_date', today);

            if (error) {
                toast.error("Couldn't undo that — your points are unchanged.");
                return;
            }
            invalidate('habits');
            await removePoints(habit.points, `Unchecked habit: ${habit.title}`);
            return;
        }

        const { error } = await supabase.from('habit_completions').insert({
            user_id: user.id,
            habit_id: habit.id,
            local_date: today,
            points_awarded: habit.points
        });

        if (error) {
            toast.error("Couldn't save that — your points are unchanged.");
            return;
        }

        invalidate('habits');
        // Persist first, then celebrate and pay — the ordering Phase 1 and Phase
        // 2 both had to correct elsewhere.
        celebrate(origin);
        await addPoints(habit.points, `Completed habit: ${habit.title}`);
    };

    // ---------------------------------------------------------------------
    // HAB-6 — freezes
    // ---------------------------------------------------------------------
    const toggleFreeze = async (habit: Habit) => {
        if (!user) return;
        const frozen = freezesByHabit.get(habit.id) ?? new Set<string>();
        const isFrozen = frozen.has(today);

        if (isFrozen) {
            const { error } = await supabase
                .from('habit_freezes')
                .delete()
                .eq('habit_id', habit.id)
                .eq('local_date', today);
            if (error) return toast.error("Couldn't remove that freeze.");
            invalidate('habits');
            return;
        }

        const used = freezesUsedInMonth(frozen, today);
        if (used >= habit.freeze_budget) {
            toast.error(`No freezes left this month for ${habit.title}.`);
            return;
        }

        const { error } = await supabase.from('habit_freezes').insert({
            user_id: user.id,
            habit_id: habit.id,
            local_date: today
        });
        if (error) return toast.error("Couldn't freeze today.");
        invalidate('habits');
        toast.success(`Streak protected — ${habit.freeze_budget - used - 1} freeze(s) left this month.`);
    };

    // ---------------------------------------------------------------------
    // CRUD
    // ---------------------------------------------------------------------
    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm());
        setShowForm(true);
    };

    const openEdit = (habit: Habit) => {
        setEditing(habit);
        setForm({
            title: habit.title,
            points: habit.points,
            category: habit.category ?? 'Personal',
            color: habit.color ?? COLORS[0],
            scheduleKind: habit.schedule_kind,
            weekdays: habit.schedule_weekdays ?? [1, 2, 3, 4, 5],
            timesPerWeek: habit.schedule_times_per_week ?? 3,
            intervalDays: habit.schedule_interval_days ?? 2,
            freezeBudget: habit.freeze_budget
        });
        setShowForm(true);
    };

    /** Only the column this schedule kind uses may be set — the DB CHECK
     *  constraint rejects the row otherwise, and rightly so. */
    const scheduleColumns = (f: HabitFormState) => ({
        schedule_kind: f.scheduleKind,
        schedule_weekdays: f.scheduleKind === 'weekdays' ? [...f.weekdays].sort() : null,
        schedule_times_per_week: f.scheduleKind === 'times_per_week' ? f.timesPerWeek : null,
        schedule_interval_days: f.scheduleKind === 'every_n_days' ? f.intervalDays : null
    });

    const saveHabit = async () => {
        if (!user || !form.title.trim()) return;
        if (form.scheduleKind === 'weekdays' && form.weekdays.length === 0) {
            toast.error('Pick at least one day of the week.');
            return;
        }

        const payload = {
            title: form.title.trim(),
            points: form.points,
            category: form.category || null,
            color: form.color,
            freeze_budget: form.freezeBudget,
            ...scheduleColumns(form)
        };

        const { error } = editing
            ? await supabase.from('habits').update(payload).eq('id', editing.id)
            : await supabase.from('habits').insert({ ...payload, user_id: user.id, start_date: today });

        if (error) {
            toast.error(editing ? "Couldn't save that habit." : "Couldn't create that habit.");
            return;
        }

        invalidate('habits');
        setShowForm(false);
        setEditing(null);
        toast.success(editing ? 'Habit updated.' : 'Habit created.');
    };

    const setArchived = async (habit: Habit, archived: boolean) => {
        const { error } = await supabase.from('habits').update({ archived }).eq('id', habit.id);
        if (error) return toast.error("Couldn't update that habit.");
        invalidate('habits');
    };

    const deleteHabit = async (habit: Habit) => {
        if (!window.confirm(
            `Delete "${habit.title}"? Its completion history goes with it — archiving keeps the record.`
        )) return;

        const { error } = await supabase.from('habits').delete().eq('id', habit.id);
        if (error) return toast.error("Couldn't delete that habit.");
        invalidate('habits');
        toast.success('Habit deleted.');
    };

    return (
        <div>
            <div className="page-header mb-lg">
                <div>
                    <h2>Habits</h2>
                    <p className="text-secondary mt-1">
                        {activeCount === 0
                            ? 'The things you want to keep doing.'
                            : `${activeCount} active ${activeCount === 1 ? 'habit' : 'habits'}.`}
                    </p>
                </div>
                <Button onClick={openCreate}><Plus size={18} /> New Habit</Button>
            </div>

            {!loading && habits.length > 0 && (
                <Card className="mb-lg">
                    <Heatmap
                        values={overallValues}
                        max={Math.max(1, activeCount)}
                        title="All habits"
                        days={WINDOW_DAYS}
                    />
                </Card>
            )}

            <div className="tabs mb-lg">
                <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>
                    Active
                </button>
                <button className={`tab ${tab === 'archived' ? 'active' : ''}`} onClick={() => setTab('archived')}>
                    Archived
                </button>
            </div>

            {loading ? (
                <SkeletonList count={4} label="Loading habits" />
            ) : visible.length === 0 ? (
                <div className="empty-state">
                    <h3>{tab === 'active' ? 'No habits yet' : 'Nothing archived'}</h3>
                    <p className="text-secondary mt-2">
                        {tab === 'active'
                            ? 'Add one thing you want to do consistently. Streaks start at one.'
                            : 'Archived habits keep their history but stop asking for your attention.'}
                    </p>
                </div>
            ) : (
                <div className="habits-list">
                    {visible.map(habit => {
                        const completed = completionsByHabit.get(habit.id) ?? new Set<string>();
                        const frozen = freezesByHabit.get(habit.id) ?? new Set<string>();
                        const streak = computeStreak(habit, completed, frozen, today);
                        const due = isDueOn(habit, today);
                        const doneToday = completed.has(today);
                        const isFrozen = frozen.has(today);
                        const week = weeklyProgress(habit, completed, today);
                        const rate30 = completionRate(habit, completed, frozen, 30, today);
                        const freezesLeft = habit.freeze_budget - freezesUsedInMonth(frozen, today);
                        const color = habit.color ?? COLORS[0];
                        const isOpen = expanded === habit.id;

                        return (
                            <Card key={habit.id} className={`habit-card ${doneToday ? 'completed' : ''}`}>
                                <div className="habit-row">
                                    <button
                                        className={`habit-checkbox ${doneToday ? 'checked' : ''}`}
                                        style={{ ['--habit-color' as string]: color }}
                                        onClick={e => toggleToday(habit, originFromElement(e.currentTarget))}
                                        disabled={habit.archived}
                                        aria-label={doneToday ? `Mark ${habit.title} not done` : `Mark ${habit.title} done`}
                                        aria-pressed={doneToday}
                                    >
                                        {doneToday && <Check size={15} strokeWidth={3} />}
                                    </button>

                                    <div className="habit-main">
                                        <h3 className="habit-title">{habit.title}</h3>
                                        <div className="habit-meta">
                                            <span className="habit-schedule">{scheduleLabel(habit)}</span>
                                            {!due && !habit.archived && <span className="habit-rest">Rest day</span>}
                                            {isFrozen && <span className="habit-frozen"><Snowflake size={11} /> Frozen</span>}
                                            {week && (
                                                <span className={week.done >= week.target ? 'habit-week met' : 'habit-week'}>
                                                    {week.done}/{week.target} this week
                                                </span>
                                            )}
                                            {rate30 !== null && <span className="text-muted">{rate30}% · 30d</span>}
                                        </div>
                                    </div>

                                    <div className="habit-side">
                                        <div className="habit-streak" title="Current streak / longest">
                                            <Flame size={15} style={{ color: streak.current > 0 ? color : 'var(--text-muted)' }} />
                                            <strong>{streak.current}</strong>
                                            <span className="text-muted">/ {streak.longest}</span>
                                        </div>
                                        <span className="habit-points">+{habit.points}</span>
                                    </div>

                                    <div className="habit-actions">
                                        {!habit.archived && !doneToday && due && (
                                            <button
                                                className="icon-btn"
                                                title={isFrozen
                                                    ? 'Remove freeze'
                                                    : `Freeze today (${freezesLeft} left this month)`}
                                                onClick={() => toggleFreeze(habit)}
                                                disabled={!isFrozen && freezesLeft <= 0}
                                            >
                                                <Snowflake size={16} />
                                            </button>
                                        )}
                                        <button
                                            className="icon-btn"
                                            title={isOpen ? 'Hide history' : 'Show history'}
                                            onClick={() => setExpanded(isOpen ? null : habit.id)}
                                            aria-expanded={isOpen}
                                        >
                                            <ChevronDown size={16} className={isOpen ? 'rotated' : ''} />
                                        </button>
                                        <button className="icon-btn" title="Edit" onClick={() => openEdit(habit)}>
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            className="icon-btn"
                                            title={habit.archived ? 'Restore' : 'Archive'}
                                            onClick={() => setArchived(habit, !habit.archived)}
                                        >
                                            {habit.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                                        </button>
                                        <button
                                            className="icon-btn hover-danger"
                                            title="Delete"
                                            onClick={() => deleteHabit(habit)}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="habit-history">
                                        {/* A month, not 53 weeks: when you open one
                                            habit the question is how this month is
                                            going, and the bigger cells are legible
                                            on a phone. */}
                                        <MonthCalendar
                                            completed={completed}
                                            frozen={frozen}
                                            isDue={iso => isDueOn(habit, iso)}
                                            color={color}
                                        />
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}

            <Modal
                isOpen={showForm}
                onClose={() => { setShowForm(false); setEditing(null); }}
                title={editing ? 'Edit Habit' : 'New Habit'}
            >
                <Input
                    label="What do you want to do consistently?"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Read for 20 minutes"
                    autoFocus
                />

                <div className="form-row">
                    <Input
                        label="Points"
                        type="number"
                        min={0}
                        value={form.points}
                        onChange={e => setForm({ ...form, points: Number(e.target.value) })}
                    />
                    <Input
                        label="Category"
                        value={form.category}
                        onChange={e => setForm({ ...form, category: e.target.value })}
                    />
                </div>

                <label className="field-label mt-md">Colour</label>
                <div className="color-row">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            type="button"
                            className={`color-dot ${form.color === c ? 'selected' : ''}`}
                            style={{ background: c }}
                            onClick={() => setForm({ ...form, color: c })}
                            aria-label={`Colour ${c}`}
                        />
                    ))}
                </div>

                <label className="field-label mt-md">Repeats</label>
                <div className="schedule-kinds">
                    {([
                        ['daily', 'Every day'],
                        ['weekdays', 'Certain days'],
                        ['times_per_week', 'N× per week'],
                        ['every_n_days', 'Every N days']
                    ] as [ScheduleKind, string][]).map(([kind, label]) => (
                        <button
                            key={kind}
                            type="button"
                            className={`schedule-kind ${form.scheduleKind === kind ? 'active' : ''}`}
                            onClick={() => setForm({ ...form, scheduleKind: kind })}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {form.scheduleKind === 'weekdays' && (
                    <div className="weekday-row mt-md">
                        {WEEKDAY_LABELS.map((label, i) => (
                            <button
                                key={label}
                                type="button"
                                className={`weekday ${form.weekdays.includes(i) ? 'active' : ''}`}
                                onClick={() => setForm({
                                    ...form,
                                    weekdays: form.weekdays.includes(i)
                                        ? form.weekdays.filter(d => d !== i)
                                        : [...form.weekdays, i]
                                })}
                            >
                                {label[0]}
                            </button>
                        ))}
                    </div>
                )}

                {form.scheduleKind === 'times_per_week' && (
                    <Input
                        label="Times per week"
                        type="number"
                        min={1}
                        max={7}
                        value={form.timesPerWeek}
                        onChange={e => setForm({ ...form, timesPerWeek: Number(e.target.value) })}
                    />
                )}

                {form.scheduleKind === 'every_n_days' && (
                    <Input
                        label="Every how many days?"
                        type="number"
                        min={1}
                        value={form.intervalDays}
                        onChange={e => setForm({ ...form, intervalDays: Number(e.target.value) })}
                    />
                )}

                <Input
                    label="Streak freezes per month"
                    type="number"
                    min={0}
                    max={31}
                    value={form.freezeBudget}
                    onChange={e => setForm({ ...form, freezeBudget: Number(e.target.value) })}
                />
                <p className="text-muted form-hint">
                    A freeze marks a day as "doesn't count" so one bad day doesn't erase a long chain.
                </p>

                <div className="form-actions mt-md">
                    <Button variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>
                        Cancel
                    </Button>
                    <Button onClick={saveHabit} disabled={!form.title.trim()}>
                        {editing ? 'Save' : 'Create Habit'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

const scheduleLabel = (habit: Habit): string => {
    switch (habit.schedule_kind) {
        case 'daily':
            return 'Every day';
        case 'weekdays': {
            const days = (habit.schedule_weekdays ?? []).map(d => WEEKDAY_LABELS[d]);
            return days.length === 7 ? 'Every day' : days.join(', ');
        }
        case 'times_per_week':
            return `${habit.schedule_times_per_week}× per week`;
        case 'every_n_days':
            return habit.schedule_interval_days === 1
                ? 'Every day'
                : `Every ${habit.schedule_interval_days} days`;
        default:
            return '';
    }
};

export default HabitsView;
