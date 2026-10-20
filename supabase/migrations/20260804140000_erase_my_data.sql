-- "Erase All My Data" was a hand-maintained list of table names in Settings.tsx,
-- and Phase 3 added six tables without updating it. The result: a user who
-- erased everything kept all of their habits, completion history and bill
-- payments, while the dialog said their data was deleted. That is the same
-- class of failure as FIX-4 — a destructive action reporting success for work it
-- did not do.
--
-- Two problems to fix, not one.
--
-- 1. The list goes stale. So don't keep a list: every table holding user-owned
--    rows has a `user_id` column, and nothing else in this schema does. Deriving
--    the set from the catalog means a table added next year is covered the day
--    it is created, with nobody having to remember.
--
--    `profiles` is excluded for free, because it keys on `id` rather than
--    `user_id` — which is exactly right. The profile and the login survive; this
--    erases data, not the account (removing `auth.users` still needs FIX-5).
--
-- 2. It was sixteen separate requests behind `Promise.all`, so a failure halfway
--    left the account partly wiped. A plpgsql function is one transaction: it
--    all lands or none of it does.
--
-- SECURITY INVOKER, so RLS still applies and a caller can only ever reach their
-- own rows. The explicit auth.uid() filter is belt-and-braces on top of that.
create or replace function public.erase_my_data()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
    target   record;
    removed  integer := 0;
    affected integer;
begin
    if auth.uid() is null then
        raise exception 'erase_my_data() requires an authenticated session';
    end if;

    for target in
        select c.table_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema = c.table_schema
         and t.table_name = c.table_name
        where c.table_schema = 'public'
          and c.column_name = 'user_id'
          and t.table_type = 'BASE TABLE'
        order by c.table_name
    loop
        -- format(%I) quotes the identifier, so a table name can never be
        -- interpolated as SQL. The values come from the catalog, not from input,
        -- but the habit is worth keeping.
        execute format('delete from public.%I where user_id = auth.uid()', target.table_name);
        get diagnostics affected = row_count;
        removed := removed + affected;
    end loop;

    return removed;
end;
$$;

revoke all on function public.erase_my_data() from public, anon;
grant execute on function public.erase_my_data() to authenticated;
