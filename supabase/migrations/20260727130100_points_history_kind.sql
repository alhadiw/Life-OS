-- FIX-1 — Make the points ledger self-describing.
--
-- The ledger stored only a signed integer, so the reload path had to guess what
-- a negative row meant. It guessed "spent", which meant un-checking a task
-- (which writes a negative `Reversed:` row) counted against the balance but
-- never against the lifetime total. Result: lifetime points dropped in the UI
-- when you un-checked something, then jumped back on the next refresh, and the
-- two numbers never agreed again.
--
-- With an explicit `kind` the arithmetic is unambiguous:
--
--   lifetime = sum(earn) - sum(|reversal|)
--   unspent  = lifetime - sum(|redemption|)
--
-- `source` stays free text (it drives the History page search); `kind` is the
-- part the maths depends on.

create type public.points_entry_kind as enum ('earn', 'reversal', 'redemption');

alter table public.points_history
    add column kind public.points_entry_kind;

-- Backfill from the conventions the app has been writing since day one.
-- Verified against live data before writing this: of 64 rows there were no
-- positive `Reversed:`/`Redemption:` rows, no negative rows with any other
-- prefix, and no zero-point rows — so this classifies every row exactly.
update public.points_history
set kind = case
    when source like 'Reversed:%'   then 'reversal'::public.points_entry_kind
    when source like 'Redemption:%' then 'redemption'::public.points_entry_kind
    when points < 0                 then 'redemption'::public.points_entry_kind
    else                                 'earn'::public.points_entry_kind
end;

alter table public.points_history
    alter column kind set not null,
    alter column kind set default 'earn';

-- Keep sign and kind in agreement so the aggregate can never be re-broken by a
-- future writer. Earns are positive; reversals and redemptions are negative.
alter table public.points_history
    add constraint points_history_kind_sign_check check (
        (kind = 'earn' and points > 0) or (kind <> 'earn' and points < 0)
    );
