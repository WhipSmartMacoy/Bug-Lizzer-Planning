-- Bug-Lizzer Planning: weekly meal planning (recipes on specific days) and per-week "have at home".
-- Run after setup.sql. Safe to re-run.

create table if not exists public.meal_plan (
  id          bigint generated always as identity primary key,
  planned_for date not null,
  recipe_id   text not null,
  added_by    uuid not null default auth.uid() references auth.users(id),
  added_at    timestamptz not null default now(),
  cooked_by   uuid references auth.users(id),
  cooked_at   timestamptz
);
create index if not exists meal_plan_day on public.meal_plan(planned_for);

create table if not exists public.week_have (
  week_start date not null,
  ingredient text not null,
  marked_by  uuid not null default auth.uid() references auth.users(id),
  marked_at  timestamptz not null default now(),
  primary key (week_start, ingredient)
);

create or replace function public.log_plan_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text;
begin
  if TG_TABLE_NAME = 'meal_plan' then
    d := to_char(coalesce(new.planned_for, old.planned_for), 'Dy Mon FMDD');
    if TG_OP = 'INSERT' then
      insert into activity(user_id, action, item) values (auth.uid(), 'planned for ' || d, new.recipe_id);
    elsif TG_OP = 'DELETE' then
      insert into activity(user_id, action, item) values (auth.uid(), 'took off ' || d, old.recipe_id);
    elsif TG_OP = 'UPDATE' and new.cooked_at is not null and old.cooked_at is null then
      insert into activity(user_id, action, item) values (auth.uid(), 'cooked', new.recipe_id);
    elsif TG_OP = 'UPDATE' and new.planned_for <> old.planned_for then
      insert into activity(user_id, action, item) values (auth.uid(), 'moved to ' || d, new.recipe_id);
    end if;
  else
    insert into activity(user_id, action, item)
      values (auth.uid(), case when TG_OP = 'INSERT' then 'has at home' else 'needs to buy' end,
              coalesce(new.ingredient, old.ingredient));
  end if;
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['meal_plan','week_have'] loop
    execute format('drop trigger if exists %I_activity on public.%I', t, t);
    execute format('create trigger %I_activity after insert or update or delete on public.%I for each row execute function public.log_plan_activity()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I for all using (public.is_member()) with check (public.is_member())', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;

-- Carry over anything already in the old undated tables, then retire them.
do $$ begin
  if to_regclass('public.week_plan') is not null then
    execute 'insert into public.meal_plan (planned_for, recipe_id, added_by, added_at)
             select current_date, recipe_id, added_by, added_at from public.week_plan';
    execute 'drop table public.week_plan';
  end if;
  if to_regclass('public.have_at_home') is not null then
    execute 'insert into public.week_have (week_start, ingredient, marked_by, marked_at)
             select date_trunc(''week'', current_date)::date, ingredient, marked_by, marked_at
             from public.have_at_home on conflict do nothing';
    execute 'drop table public.have_at_home';
  end if;
end $$;
