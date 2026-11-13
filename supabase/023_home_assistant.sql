-- Bug-Lizzer Planning · 023: Home Assistant mailbox
-- The app drops a request here (e.g. "jeopardy"); Home Assistant at home checks every few seconds,
-- picks it up and runs its own script. Nothing at home is reachable from outside.
create table if not exists public.home_commands (
  id         bigint generated always as identity primary key,
  cmd        text not null,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  taken_at   timestamptz,
  done_at    timestamptz,
  result     text
);
alter table public.home_commands enable row level security;
drop policy if exists "members send" on public.home_commands;
create policy "members send" on public.home_commands for insert to authenticated with check (public.is_member());
drop policy if exists "members read" on public.home_commands;
create policy "members read" on public.home_commands for select to authenticated using (public.is_member());

-- Home Assistant's key lives here; no policies, so only the functions below can read it.
create table if not exists public.home_secrets (key text primary key, value text not null);
alter table public.home_secrets enable row level security;

create or replace function public.ha_ok() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from home_secrets where key = 'ha_token'
    and value = coalesce(current_setting('request.headers', true)::json->>'x-ha-token', ''));
$$;
revoke all on function public.ha_ok() from public, anon, authenticated;

create or replace function public.ha_poll() returns setof public.home_commands
language plpgsql security definer set search_path = public as $$
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into app_settings(key, value) values ('ha_seen', now()::text)
    on conflict (key) do update set value = excluded.value;
  return query
    update home_commands set taken_at = now()
     where id in (select id from home_commands where taken_at is null and created_at > now() - interval '2 minutes' order by id limit 5)
    returning *;
end $$;

create or replace function public.ha_done(p_id bigint, p_result text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update home_commands set done_at = now(), result = left(p_result, 300) where id = p_id;
end $$;
revoke all on function public.ha_poll() from public;
revoke all on function public.ha_done(bigint, text) from public;
grant execute on function public.ha_poll() to anon;
grant execute on function public.ha_done(bigint, text) to anon;
