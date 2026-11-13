-- Bug-Lizzer Planning · 024: the app as a remote for Home Assistant
-- Commands can carry details (which light, which scene), and Home Assistant publishes what it has.
alter table public.home_commands add column if not exists args jsonb;

drop function if exists public.ha_poll();
create function public.ha_poll() returns setof public.home_commands
language plpgsql security definer set search_path = public as $$
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into app_settings(key, value) values ('ha_seen', now()::text)
    on conflict (key) do update set value = excluded.value;
  return query
    update home_commands set taken_at = now()
     where id in (select id from home_commands where taken_at is null and created_at > now() - interval '2 minutes' order by id limit 10)
    returning *;
end $$;
revoke all on function public.ha_poll() from public;
grant execute on function public.ha_poll() to anon;

-- Home Assistant's picture of the house: areas, lights, scenes, scripts, TV.
create or replace function public.ha_publish(p_state jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  insert into app_settings(key, value) values ('ha_state', p_state::text), ('ha_seen', now()::text)
    on conflict (key) do update set value = excluded.value;
end $$;
revoke all on function public.ha_publish(jsonb) from public;
grant execute on function public.ha_publish(jsonb) to anon;
