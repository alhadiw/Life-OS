-- FIX-4 — Complete the `profiles` policy set.
--
-- Every other table carries the full four policies (select/insert/update/delete).
-- `profiles` had only select and update, which meant
-- `supabase.from('profiles').delete()` was filtered to zero rows by RLS while
-- PostgREST still reported success — the account-deletion flow in Settings
-- destroyed every row of user data and then silently failed to remove the
-- profile, reporting success either way. A destructive action that lies about
-- what it did is the worst kind of bug in a tracker.
--
-- INSERT is added alongside it so a signed-in user whose profile row is missing
-- can recreate their own row. handle_new_user() (SECURITY DEFINER) still creates
-- it at signup; this is the recovery path, and it can only ever write a row
-- keyed to the caller's own uid.
--
-- Note that this makes the *policy* correct; it does not by itself make
-- "Delete Account" remove the auth.users row — that needs service-role access
-- the browser does not have (FIX-5, a Supabase Edge Function). Until then the
-- Settings action is presented honestly as erasing data, not deleting the login.

create policy "Users can insert own profile"
    on public.profiles
    for insert
    to public
    with check (auth.uid() = id);

create policy "Users can delete own profile"
    on public.profiles
    for delete
    to public
    using (auth.uid() = id);
