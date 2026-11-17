-- OnlyLoafs — make the administrator check run with the caller's own rights
-- ---------------------------------------------------------------------
-- Supabase's security advisor flags SECURITY DEFINER functions that
-- visitors can call. is_admin() doesn't need elevated rights: every
-- caller may look up their OWN row in public.admins (and only that row),
-- which is all the check requires. Visitors have no user id, so they
-- match nothing.

alter policy "Users read their own admin row" on public.admins
  to anon, authenticated
  using (user_id = (select auth.uid()));

grant select on public.admins to anon;

create or replace function public.is_admin() returns boolean
language sql stable security invoker set search_path = ''
as $$
  select exists (
    select 1 from public.admins where user_id = (select auth.uid())
  );
$$;
