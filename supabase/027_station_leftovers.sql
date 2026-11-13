-- Bug-Lizzer Planning · 027: leftovers from the iPad Station (through Home Assistant).
-- Give a serving to Amy or Parker for a meal today, or throw the rest out.
create or replace function public.station_leftover(p_id bigint, p_person text, p_meal text) returns json
language plpgsql security definer set search_path = public as $$
declare src meal_plan; d date := (now() at time zone 'America/New_York')::date; s json;
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  if p_person not in ('Amy', 'Parker') or p_meal not in ('breakfast', 'lunch', 'snack') then raise exception 'bad request'; end if;
  select * into src from meal_plan where id = p_id and leftover_of is null;
  if src.id is null then raise exception 'no such leftovers'; end if;
  insert into meal_plan(planned_for, meal, person, recipe_id, leftover_of) values (d, p_meal, p_person, src.recipe_id, src.id);
  -- keep the Station's summary in step until the app refreshes it
  select value::json into s from app_settings where key = 'station';
  if s is not null then
    update app_settings set value = (
      jsonb_set(s::jsonb, '{left}', coalesce((select jsonb_agg(case when (x->>'id')::bigint = p_id then jsonb_set(x, '{servings}', to_jsonb((x->>'servings')::int - 1)) else x end)
                                              from jsonb_array_elements(s::jsonb->'left') x
                                             where not ((x->>'id')::bigint = p_id and (x->>'servings')::int <= 1)), '[]'::jsonb))
    )::text where key = 'station';
  end if;
  return json_build_object('ok', true);
end $$;

create or replace function public.station_leftover_remove(p_id bigint) returns json
language plpgsql security definer set search_path = public as $$
declare s json;
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  update meal_plan set left_after = 0 where id = p_id and leftover_of is null;   -- nothing left
  select value::json into s from app_settings where key = 'station';
  if s is not null then
    update app_settings set value = (jsonb_set(s::jsonb, '{left}', coalesce((select jsonb_agg(x) from jsonb_array_elements(s::jsonb->'left') x where (x->>'id')::bigint <> p_id), '[]'::jsonb)))::text
     where key = 'station';
  end if;
  return json_build_object('ok', true);
end $$;
revoke all on function public.station_leftover(bigint, text, text) from public;
revoke all on function public.station_leftover_remove(bigint) from public;
grant execute on function public.station_leftover(bigint, text, text) to anon;
grant execute on function public.station_leftover_remove(bigint) to anon;
