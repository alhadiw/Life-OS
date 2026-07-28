-- FIX-3 — Add the missing indexes.
--
-- Before this migration the database had exactly twelve indexes: the twelve
-- primary keys. Every RLS-filtered read (`where user_id = auth.uid()`) was a
-- sequential scan over the whole table. Cheap to fix, compounding cost if not.
--
-- The leading column is always `user_id` because that is what RLS filters on;
-- the second column, where present, is what the app orders or filters by.

-- Loaded in full on every login by PointsContext, newest first.
create index if not exists points_history_user_id_created_at_idx
    on public.points_history (user_id, created_at desc);

create index if not exists tasks_user_id_idx
    on public.tasks (user_id);

-- The Tasks page splits goals by `period` (weekly / monthly).
create index if not exists goals_user_id_period_idx
    on public.goals (user_id, period);

-- The Dashboard queries unpaid bills within a due-date window.
create index if not exists finance_bills_user_id_due_date_idx
    on public.finance_bills (user_id, due_date);

create index if not exists finance_savings_user_id_idx
    on public.finance_savings (user_id);

create index if not exists finance_investments_user_id_idx
    on public.finance_investments (user_id);

-- The Books page filters by `status` on every tab.
create index if not exists books_user_id_status_idx
    on public.books (user_id, status);

-- Workout history and streaks read newest-date-first.
create index if not exists exercises_user_id_exercise_date_idx
    on public.exercises (user_id, exercise_date desc);

create index if not exists exercise_goals_user_id_idx
    on public.exercise_goals (user_id);

create index if not exists user_lists_user_id_idx
    on public.user_lists (user_id);

create index if not exists list_items_user_id_idx
    on public.list_items (user_id);

-- list_items.list_id is a foreign key with ON DELETE CASCADE and no index,
-- so deleting a list scanned the whole child table.
create index if not exists list_items_list_id_idx
    on public.list_items (list_id);
