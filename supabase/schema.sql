-- =============================================================================
-- Life OS — schema snapshot of the hosted Supabase project (ref dzajismvbgrkxjsouewl)
-- Postgres 17.6. Captured 2026-07-27 from the live catalogs.
--
-- REFERENCE ONLY — DO NOT EXECUTE against the live database.
-- This is reconstructed from pg_catalog / information_schema, not pg_dump, so it
-- is accurate for structure but is not a migration and is not ordered for replay.
--
-- This is the BASELINE: the schema as it stood before versioned migrations were
-- introduced. It is not kept in sync. For the current schema, read this file and
-- then every file in migrations/ in filename order.
-- =============================================================================

-- ---------------------------------------------------------------- enum types
create type public.book_status     as enum ('want_to_read', 'reading', 'finished');
create type public.goal_period     as enum ('weekly', 'monthly');
create type public.intensity_level as enum ('Light', 'Moderate', 'Intense');

-- ------------------------------------------------------------------- profiles
-- One row per auth user, created automatically by the on_auth_user_created
-- trigger below. Note it keys on `id`, not `user_id` — every other table
-- references THIS table, not auth.users directly.
create table public.profiles (
  id              uuid        not null primary key references auth.users (id),
  email           text        not null,                      -- no unique constraint
  display_name    text,
  conversion_rate numeric     not null default 100,           -- points per 1 currency unit
  currency_symbol text        not null default '$',
  created_at      timestamptz not null default timezone('utc', now()),
  updated_at      timestamptz not null default timezone('utc', now())
);

-- ---------------------------------------------------------- points & tracking
create table public.points_history (
  id             uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id        uuid        not null references public.profiles (id),
  points         integer     not null,   -- signed: positive = earned, negative = spent/reversed
  source         text        not null,   -- free text; drives the History page search
  monetary_value numeric     not null,   -- points / conversion_rate AT TIME OF WRITING
  created_at     timestamptz not null default timezone('utc', now())
);

-- Daily tasks.
create table public.tasks (
  id         uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id    uuid        not null references public.profiles (id),
  title      text        not null,
  points     integer     not null,
  category   text,
  due_date   date,                        -- column exists but the UI never writes it
  completed  boolean     not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Weekly + monthly goals, discriminated by `period`.
create table public.goals (
  id          uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id     uuid        not null references public.profiles (id),
  title       text        not null,
  period      public.goal_period not null,
  target_date date        not null,
  points      integer     not null,
  category    text,
  description text,                       -- unused by the UI
  completed   boolean     not null default false,
  created_at  timestamptz not null default timezone('utc', now())
);

-- --------------------------------------------------------------------- finance
create table public.finance_bills (
  id         uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id    uuid        not null references public.profiles (id),
  name       text        not null,
  amount     numeric     not null,
  due_date   date        not null,
  frequency  text        not null,        -- plain text, NOT constrained; UI writes 'monthly' | 'one-time'
  category   text,
  paid       boolean     not null default false,
  notes      text,                        -- unused by the UI
  created_at timestamptz not null default timezone('utc', now())
);

create table public.finance_savings (
  id             uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id        uuid        not null references public.profiles (id),
  name           text        not null,
  target_amount  numeric     not null,
  current_amount numeric     not null default 0,
  target_date    date,                    -- unused by the UI
  notes          text,                    -- unused by the UI
  created_at     timestamptz not null default timezone('utc', now())
);

create table public.finance_investments (
  id              uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id         uuid        not null references public.profiles (id),
  platform        text        not null,
  asset           text        not null,
  amount          numeric     not null,
  investment_date date        not null,
  notes           text,                   -- unused by the UI
  created_at      timestamptz not null default timezone('utc', now())
);

-- ----------------------------------------------------------------------- books
create table public.books (
  id            uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id       uuid        not null references public.profiles (id),
  title         text        not null,
  author        text        not null,
  status        public.book_status not null default 'want_to_read',
  genre         text,
  rating        integer     check (rating >= 1 and rating <= 5),
  notes         text,                     -- unused by the UI
  date_started  date,                     -- unused by the UI
  date_finished date,                     -- unused by the UI
  cover_image   text,
  created_at    timestamptz not null default timezone('utc', now())
);

-- -------------------------------------------------------------------- exercise
create table public.exercises (
  id               uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id          uuid        not null references public.profiles (id),
  type             text        not null,
  duration_minutes integer     not null,
  exercise_date    date        not null,
  intensity        public.intensity_level,
  notes            text,
  created_at       timestamptz not null default timezone('utc', now())
);

create table public.exercise_goals (
  id            uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id       uuid        not null references public.profiles (id),
  title         text        not null,
  period        public.goal_period not null,
  target_value  integer     not null,
  current_value integer     not null default 0,
  metric        text        not null,     -- plain text, NOT constrained; UI writes 'sessions' | 'minutes'
  completed     boolean     not null default false,
  points_reward integer     not null,
  created_at    timestamptz not null default timezone('utc', now())
);

-- -------------------------------------------------------------------- my lists
create table public.user_lists (
  id         uuid        not null primary key default extensions.uuid_generate_v4(),
  user_id    uuid        not null references public.profiles (id),
  name       text        not null,
  icon       text,                        -- a lucide-react component name, e.g. 'ShoppingCart'
  color      text,                        -- hex string, e.g. '#3B82F6'
  created_at timestamptz not null default timezone('utc', now())
);

create table public.list_items (
  id         uuid        not null primary key default extensions.uuid_generate_v4(),
  list_id    uuid        not null references public.user_lists (id) on delete cascade,
  user_id    uuid        not null references public.profiles (id),
  text       text        not null,
  checked    boolean     not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- =============================================================================
-- Indexes
-- =============================================================================
-- At the time of this snapshot: NONE beyond the twelve primary keys. No index
-- on any `user_id`, `created_at`, `due_date`, or `exercise_date` column, so
-- every RLS-filtered read was a sequential scan — worst of all on
-- points_history, which is loaded in full on every login.
--
-- Fixed by migrations/20260727130000_add_indexes.sql.

-- =============================================================================
-- Functions & triggers
-- =============================================================================

-- Creates the profiles row when a user signs up. SECURITY DEFINER, so it works
-- despite profiles having no INSERT policy.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Event trigger helper that auto-enables RLS on any newly created public table.
-- (Defined in the project; keeps new tables from shipping unprotected.)
-- create or replace function public.rls_auto_enable() returns event_trigger ...

-- NOTE: nothing maintains profiles.updated_at — there is no BEFORE UPDATE
-- trigger, so it permanently equals created_at.

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- RLS is ENABLED on all 12 tables.
--
-- Eleven tables (everything except profiles) carry the identical four policies,
-- all targeting role `public`:
--
--   "Users can view own   <table>"  FOR SELECT USING      (auth.uid() = user_id)
--   "Users can insert own <table>"  FOR INSERT WITH CHECK (auth.uid() = user_id)
--   "Users can update own <table>"  FOR UPDATE USING      (auth.uid() = user_id)
--   "Users can delete own <table>"  FOR DELETE USING      (auth.uid() = user_id)
--
-- profiles has only TWO policies, keyed on `id` rather than `user_id`:
--
--   "Users can view own profiles"   FOR SELECT USING (auth.uid() = id)
--   "Users can update own profiles" FOR UPDATE USING (auth.uid() = id)
--
-- At the time of this snapshot there was NO INSERT policy (unnecessary —
-- handle_new_user is SECURITY DEFINER) and NO DELETE policy. The missing DELETE
-- policy meant the account-deletion flow in Settings.tsx could not remove the
-- profiles row: RLS filtered it to zero rows and PostgREST reported success
-- anyway, so the UI claimed to have deleted an account it had not touched.
--
-- Both policies added by migrations/20260727130200_profiles_policies.sql.
