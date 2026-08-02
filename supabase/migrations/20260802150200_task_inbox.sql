-- TSK-3 — quick capture inbox.
--
-- The point of a capture inbox is that it costs one field and no decisions. A
-- task normally needs a title, points and a category before it can exist; that
-- is exactly the friction that stops you writing the thing down at all.
--
-- An inbox item is therefore just a task with `inbox = true` and defaults for
-- everything else. Triage flips the flag and fills in the detail, so nothing has
-- to be copied between tables and no separate type appears in the UI.

alter table public.tasks
    add column inbox boolean not null default false;

-- `points` was NOT NULL with no default, so a title-only insert failed. 10
-- matches the default a new habit gets.
alter table public.tasks
    alter column points set default 10;

-- Partial index: the inbox view is always "untriaged only", and untriaged items
-- are a small minority of the table.
create index tasks_user_id_inbox_idx
    on public.tasks (user_id)
    where inbox;
