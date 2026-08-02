-- ARCH-2 — aggregate points in Postgres instead of in the browser.
--
-- PointsContext read the ENTIRE points_history table on every login and summed
-- it in JavaScript. That is on the startup path, so it grows into a launch delay
-- that no amount of indexing fixes — the cost is transfer and parse, not lookup.
--
-- The split below must stay identical to summarise() in PointsContext, because
-- the ledger is the single source of truth and there is no balance column to
-- reconcile against:
--   lifetime  = sum where kind <> 'redemption'   (earns and reversals net out)
--   unspent   = sum of everything                (redemptions are negative)
--
-- SECURITY INVOKER (the default) is deliberate: the function runs as the caller,
-- so RLS on points_history still applies. The explicit auth.uid() filter is
-- belt-and-braces — if a future policy change widened visibility, this function
-- would still only ever total the caller's own rows.
create or replace function public.points_summary()
returns table (
    lifetime_points  bigint,
    unspent_points   bigint,
    lifetime_money   numeric,
    unspent_money    numeric,
    entry_count      bigint
)
language sql
stable
security invoker
set search_path = public
as $$
    select
        coalesce(sum(points) filter (where kind <> 'redemption'), 0)::bigint,
        coalesce(sum(points), 0)::bigint,
        coalesce(sum(monetary_value) filter (where kind <> 'redemption'), 0)::numeric,
        coalesce(sum(monetary_value), 0)::numeric,
        count(*)::bigint
    from public.points_history
    where user_id = auth.uid();
$$;

-- PostgREST exposes this at POST /rest/v1/rpc/points_summary. Only signed-in
-- users may call it; anon gets nothing useful anyway thanks to the auth.uid()
-- filter, but there is no reason to expose the entry point.
revoke all on function public.points_summary() from public, anon;
grant execute on function public.points_summary() to authenticated;
