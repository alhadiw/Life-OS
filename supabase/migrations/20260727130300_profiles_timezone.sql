-- FIX-6 — Store the user's timezone.
--
-- The app mixed two different notions of "today": date-fns `format()` (local)
-- and `new Date().toISOString().split('T')[0]` (UTC). Those disagree for part of
-- every day in every timezone that isn't UTC, so workouts, bills and streaks
-- could land on the wrong day depending on what time you opened the app.
--
-- All date-only values (`due_date`, `exercise_date`, `target_date`) are stored
-- as Postgres `date` and are meant to be read in the *user's* local calendar,
-- not the browser's and not UTC. Persisting the zone means "today" is stable
-- across devices and survives travel.
--
-- Nullable on purpose: null means "not yet determined", and the client fills it
-- in from Intl.DateTimeFormat().resolvedOptions().timeZone on first load. That
-- avoids defaulting every existing user to UTC, which would be wrong for all of
-- them. Values are IANA zone names, e.g. 'Africa/Addis_Ababa'.

alter table public.profiles
    add column timezone text;

comment on column public.profiles.timezone is
    'IANA timezone name (e.g. America/New_York). Null until the client detects it. '
    'Defines the calendar day used for due dates, streaks and daily rollover.';
