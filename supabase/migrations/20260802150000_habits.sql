-- HAB-1 (habits module), HAB-2 (flexible scheduling), HAB-6 (streak freezes).
--
-- Habits are deliberately a separate concept from tasks, per DESIGN.md §6 D1 and
-- the answer implied by HAB-1's own wording ("Separate from tasks"). A task is a
-- thing you finish once; a habit is a thing you keep doing. Conflating them is
-- what made `tasks` pretend to be habits and lose their history in the first
-- place.

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------
-- Four shapes cover every case in HAB-2 without a cron-expression parser:
--   daily          — every day
--   weekdays       — specific days of the week
--   times_per_week — N completions in a Mon–Sun week, any days
--   every_n_days   — a fixed cadence from the habit's start date
create type public.habit_schedule_kind as enum
    ('daily', 'weekdays', 'times_per_week', 'every_n_days');

create table public.habits (
    id                      uuid primary key default extensions.uuid_generate_v4(),
    user_id                 uuid not null references public.profiles(id),

    title                   text not null,
    icon                    text,           -- lucide-react icon name; null = default
    color                   text,           -- hex; null = --primary-color
    points                  integer not null default 10,
    category                text,
    archived                boolean not null default false,

    schedule_kind           public.habit_schedule_kind not null default 'daily',
    -- 0 = Sunday .. 6 = Saturday, matching JS getDay(). Only for 'weekdays'.
    schedule_weekdays       smallint[],
    schedule_times_per_week smallint,       -- only for 'times_per_week'
    schedule_interval_days  smallint,       -- only for 'every_n_days'
    -- Anchor for 'every_n_days'. Also the date the habit starts counting, so a
    -- habit created today does not read as "missed" for all of history.
    start_date              date not null default current_date,

    -- HAB-6. Skips per calendar month that do not break a chain. A punishing
    -- streak system makes people quit after one bad day (DESIGN.md §6 D1).
    freeze_budget           smallint not null default 2,

    created_at              timestamptz not null default timezone('utc', now()),

    -- Each schedule kind must carry exactly the parameter it needs, and must not
    -- carry the others. Without this, a 'weekdays' habit with a null weekday
    -- array is silently never due.
    constraint habits_schedule_params_check check (
        case schedule_kind
            when 'daily' then
                schedule_weekdays is null
                and schedule_times_per_week is null
                and schedule_interval_days is null
            when 'weekdays' then
                schedule_weekdays is not null
                and array_length(schedule_weekdays, 1) between 1 and 7
                and schedule_times_per_week is null
                and schedule_interval_days is null
            when 'times_per_week' then
                schedule_times_per_week between 1 and 7
                and schedule_weekdays is null
                and schedule_interval_days is null
            when 'every_n_days' then
                schedule_interval_days >= 1
                and schedule_weekdays is null
                and schedule_times_per_week is null
        end
    ),
    -- Array containment rather than `select bool_and(...) from unnest(...)`:
    -- Postgres rejects subqueries in CHECK constraints outright (0A000).
    constraint habits_weekdays_range_check check (
        schedule_weekdays is null
        or schedule_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
    ),
    constraint habits_points_check check (points >= 0),
    constraint habits_freeze_budget_check check (freeze_budget between 0 and 31)
);

-- Leading on user_id because that is what RLS filters on; `archived` second
-- because the page always splits active from archived.
create index habits_user_id_archived_idx on public.habits (user_id, archived);

alter table public.habits enable row level security;

create policy "Users can view their own habits"
    on public.habits for select using (auth.uid() = user_id);
create policy "Users can insert their own habits"
    on public.habits for insert with check (auth.uid() = user_id);
create policy "Users can update their own habits"
    on public.habits for update using (auth.uid() = user_id);
create policy "Users can delete their own habits"
    on public.habits for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- HAB-6 — streak freezes
-- ---------------------------------------------------------------------------
-- A freeze is an explicit "this day doesn't count against me" marker. Kept in
-- its own table rather than as a flag on the completion row, because a freeze is
-- precisely the absence of a completion — there is no completion row to flag.
create table public.habit_freezes (
    id          uuid primary key default extensions.uuid_generate_v4(),
    user_id     uuid not null references public.profiles(id),
    habit_id    uuid not null references public.habits(id) on delete cascade,
    local_date  date not null,
    created_at  timestamptz not null default timezone('utc', now()),

    -- One freeze per habit per day. Makes the write idempotent.
    constraint habit_freezes_unique unique (habit_id, local_date)
);

create index habit_freezes_user_id_local_date_idx
    on public.habit_freezes (user_id, local_date desc);

alter table public.habit_freezes enable row level security;

create policy "Users can view their own habit freezes"
    on public.habit_freezes for select using (auth.uid() = user_id);
create policy "Users can insert their own habit freezes"
    on public.habit_freezes for insert with check (auth.uid() = user_id);
create policy "Users can update their own habit freezes"
    on public.habit_freezes for update using (auth.uid() = user_id);
create policy "Users can delete their own habit freezes"
    on public.habit_freezes for delete using (auth.uid() = user_id);
