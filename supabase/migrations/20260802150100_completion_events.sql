-- ARCH-1 — completion-event data model.
--
-- The problem this replaces: `useAutoReset` cleared `tasks.completed` daily,
-- `goals.completed` weekly/monthly, and rolled `finance_bills` monthly. Each
-- reset destroyed the only record that the thing had ever been done, which is
-- why streaks, heatmaps and consistency stats were impossible to build.
--
-- The new rule: **"done" means a row exists**. Completing writes a row keyed on
-- (item, local_date); un-completing deletes it. Nothing is ever cleared on a
-- schedule, so history accumulates instead of evaporating, and there is no
-- launch-time write storm and no timezone drift in a reset stamp.
--
-- `local_date` is the user's own calendar date (src/lib/dates.ts decides it),
-- not UTC — the whole point of FIX-6. Postgres `date`, so it compares with < and
-- carries no time to misinterpret.
--
-- Per DESIGN.md §11 the old boolean columns (`tasks.completed`,
-- `goals.completed`, `finance_bills.paid`) are deliberately KEPT for a release
-- rather than dropped. They are backfilled from here and no longer read by the
-- app, but leaving them means this migration is reversible without data loss.

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------
create table public.habit_completions (
    id              uuid primary key default extensions.uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id),
    habit_id        uuid not null references public.habits(id) on delete cascade,
    local_date      date not null,
    -- What was actually paid at the time. Habit points can change later; the
    -- ledger should not retroactively disagree with itself.
    points_awarded  integer not null default 0,
    created_at      timestamptz not null default timezone('utc', now()),

    constraint habit_completions_unique unique (habit_id, local_date)
);

-- (user_id, local_date desc) serves both the heatmap (a date range for one user)
-- and the dashboard's "what's done today".
create index habit_completions_user_id_local_date_idx
    on public.habit_completions (user_id, local_date desc);
-- Streaks walk one habit's history backwards.
create index habit_completions_habit_id_local_date_idx
    on public.habit_completions (habit_id, local_date desc);

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table public.task_completions (
    id              uuid primary key default extensions.uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id),
    task_id         uuid not null references public.tasks(id) on delete cascade,
    local_date      date not null,
    points_awarded  integer not null default 0,
    created_at      timestamptz not null default timezone('utc', now()),

    constraint task_completions_unique unique (task_id, local_date)
);

create index task_completions_user_id_local_date_idx
    on public.task_completions (user_id, local_date desc);

-- ---------------------------------------------------------------------------
-- Goals (weekly / monthly)
-- ---------------------------------------------------------------------------
-- Keyed on the first day of the period rather than the completion day, so
-- "completed this week" is a single equality test against a value the client
-- already computes (startOfWeekISO / startOfMonthISO).
create table public.goal_completions (
    id              uuid primary key default extensions.uuid_generate_v4(),
    user_id         uuid not null references public.profiles(id),
    goal_id         uuid not null references public.goals(id) on delete cascade,
    period_start    date not null,
    points_awarded  integer not null default 0,
    created_at      timestamptz not null default timezone('utc', now()),

    constraint goal_completions_unique unique (goal_id, period_start)
);

create index goal_completions_user_id_period_start_idx
    on public.goal_completions (user_id, period_start desc);

-- ---------------------------------------------------------------------------
-- Bills
-- ---------------------------------------------------------------------------
-- The last piece needed to delete useAutoReset outright. "Paid this month" was
-- a boolean the reset flipped back every month while also mutating due_date;
-- now it is the existence of a payment row for that month, and due_date stays
-- the immutable day-of-month the bill falls on.
create table public.bill_payments (
    id            uuid primary key default extensions.uuid_generate_v4(),
    user_id       uuid not null references public.profiles(id),
    bill_id       uuid not null references public.finance_bills(id) on delete cascade,
    -- Always the first of the month, so equality works.
    period_month  date not null,
    amount        numeric,
    created_at    timestamptz not null default timezone('utc', now()),

    constraint bill_payments_unique unique (bill_id, period_month),
    constraint bill_payments_period_is_first_of_month
        check (date_trunc('month', period_month)::date = period_month)
);

create index bill_payments_user_id_period_month_idx
    on public.bill_payments (user_id, period_month desc);

-- ---------------------------------------------------------------------------
-- RLS — the same four-policy set every other table carries
-- ---------------------------------------------------------------------------
alter table public.habit_completions enable row level security;
alter table public.task_completions  enable row level security;
alter table public.goal_completions  enable row level security;
alter table public.bill_payments     enable row level security;

create policy "Users can view their own habit completions"
    on public.habit_completions for select using (auth.uid() = user_id);
create policy "Users can insert their own habit completions"
    on public.habit_completions for insert with check (auth.uid() = user_id);
create policy "Users can update their own habit completions"
    on public.habit_completions for update using (auth.uid() = user_id);
create policy "Users can delete their own habit completions"
    on public.habit_completions for delete using (auth.uid() = user_id);

create policy "Users can view their own task completions"
    on public.task_completions for select using (auth.uid() = user_id);
create policy "Users can insert their own task completions"
    on public.task_completions for insert with check (auth.uid() = user_id);
create policy "Users can update their own task completions"
    on public.task_completions for update using (auth.uid() = user_id);
create policy "Users can delete their own task completions"
    on public.task_completions for delete using (auth.uid() = user_id);

create policy "Users can view their own goal completions"
    on public.goal_completions for select using (auth.uid() = user_id);
create policy "Users can insert their own goal completions"
    on public.goal_completions for insert with check (auth.uid() = user_id);
create policy "Users can update their own goal completions"
    on public.goal_completions for update using (auth.uid() = user_id);
create policy "Users can delete their own goal completions"
    on public.goal_completions for delete using (auth.uid() = user_id);

create policy "Users can view their own bill payments"
    on public.bill_payments for select using (auth.uid() = user_id);
create policy "Users can insert their own bill payments"
    on public.bill_payments for insert with check (auth.uid() = user_id);
create policy "Users can update their own bill payments"
    on public.bill_payments for update using (auth.uid() = user_id);
create policy "Users can delete their own bill payments"
    on public.bill_payments for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Backfill — carry today's state across so nothing appears to un-complete
-- ---------------------------------------------------------------------------
-- Each user's "today" is read through their own stored IANA zone (FIX-6). A user
-- who has never opened the app since the timezone column shipped has null there;
-- UTC is the honest fallback rather than guessing.

insert into public.task_completions (user_id, task_id, local_date, points_awarded)
select t.user_id,
       t.id,
       (timezone(coalesce(p.timezone, 'UTC'), now()))::date,
       t.points
from public.tasks t
join public.profiles p on p.id = t.user_id
where t.completed
on conflict do nothing;

-- date_trunc('week', ...) is Monday-based in Postgres, which matches the Monday
-- week start the app has always used.
insert into public.goal_completions (user_id, goal_id, period_start, points_awarded)
select g.user_id,
       g.id,
       case g.period
           when 'weekly'  then date_trunc('week',  timezone(coalesce(p.timezone, 'UTC'), now()))::date
           when 'monthly' then date_trunc('month', timezone(coalesce(p.timezone, 'UTC'), now()))::date
       end,
       g.points
from public.goals g
join public.profiles p on p.id = g.user_id
where g.completed
on conflict do nothing;

insert into public.bill_payments (user_id, bill_id, period_month, amount)
select b.user_id,
       b.id,
       date_trunc('month', timezone(coalesce(p.timezone, 'UTC'), now()))::date,
       b.amount
from public.finance_bills b
join public.profiles p on p.id = b.user_id
where b.paid
on conflict do nothing;
