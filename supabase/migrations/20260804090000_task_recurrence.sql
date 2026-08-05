-- Tasks become one-off by default, with repeating as an opt-in.
--
-- Until now every daily task repeated implicitly: completion is a row keyed on
-- (task_id, local_date), so tomorrow's query finds no row and the task comes
-- back. That made `tasks` a second, weaker habits system — which is exactly what
-- HAB-1 replaced. A task should be a thing you finish and never see again; a
-- habit is the thing you keep doing.
--
-- `recurring` is the discriminator. A recurring task behaves as before. A
-- one-off disappears from the list once it has ANY completion row.
--
-- Note this changes *display*, not storage: the completion row is still written
-- and still kept, so a finished one-off keeps contributing to history and to the
-- ledger. Nothing is deleted.

alter table public.tasks
    add column recurring boolean not null default false;

-- Every existing task was created under the old always-repeats semantics, and
-- most of them plainly are habits ("Brush morning", "Make bed", "7 hours of
-- sleep"). Defaulting them to one-off would make the whole list vanish the first
-- time each was ticked. Backfill to true so behaviour is unchanged for anything
-- that already exists; only newly created tasks get the new default.
update public.tasks set recurring = true;

-- The Tasks page and the Dashboard both need "has this one-off ever been
-- completed", which is an existence check against task_completions by task_id.
-- The existing task_completions index leads on user_id, so add the task_id one.
create index if not exists task_completions_task_id_idx
    on public.task_completions (task_id);
