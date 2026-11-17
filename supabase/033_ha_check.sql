-- Home Assistant's recipe search (Allrecipes, Serious Eats from the home laptop) signs in to the
-- find-recipes function with its own token; the function asks the database whether it's the right one.
create or replace function public.ha_check() returns boolean
language sql stable security definer set search_path = public as $$ select public.ha_ok() $$;
revoke all on function public.ha_check() from public;
grant execute on function public.ha_check() to anon;
