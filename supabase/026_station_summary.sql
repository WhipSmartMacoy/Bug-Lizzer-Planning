-- Bug-Lizzer Planning · 026: the iPad Station also gets the app's summary (week's dinners, to-buy list, leftovers).
-- Replaces station_today from 025.
-- Home Assistant asks for it (with its key) and hands it to the Station page on the home network.
create or replace function public.station_today() returns json
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'America/New_York')::date;
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  return json_build_object(
    'date', d,
    'dinner', (select json_build_object('what', coalesce(r.title, m.note), 'leftovers', m.leftover_of is not null, 'cooked', m.cooked_at is not null)
                 from meal_plan m left join recipes r on r.id = m.recipe_id
                where m.planned_for = d and m.meal = 'dinner' and m.person is null order by m.id limit 1),
    'tomorrow', (select coalesce(r.title, m.note)
                   from meal_plan m left join recipes r on r.id = m.recipe_id
                  where m.planned_for = d + 1 and m.meal = 'dinner' and m.person is null order by m.id limit 1),
    'meals', coalesce((select json_agg(json_build_object('person', m.person, 'meal', m.meal, 'what', coalesce(r.title, m.note))
                         order by m.person, case m.meal when 'breakfast' then 1 when 'lunch' then 2 when 'dinner' then 3 else 4 end, m.id)
                         from meal_plan m left join recipes r on r.id = m.recipe_id
                        where m.planned_for = d and m.person is not null and m.meal <> 'scan'), '[]'::json),
    'summary', (select value::json from app_settings where key = 'station')
  );
end $$;
revoke all on function public.station_today() from public;
grant execute on function public.station_today() to anon;
