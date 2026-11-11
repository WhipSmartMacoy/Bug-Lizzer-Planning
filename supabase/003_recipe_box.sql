-- Bug-Lizzer Planning: household recipe box (added by pasting a link) and per-ingredient prices.
-- Run after 002_weekly_plan.sql.

create table if not exists public.recipes (
  id          bigint generated always as identity primary key,
  url         text not null unique,
  title       text not null,
  image_url   text,
  site        text,
  ingredients text[] not null default '{}',   -- plain ingredient names only, no quantities/steps
  added_by    uuid not null default auth.uid() references auth.users(id),
  added_at    timestamptz not null default now()
);

create table if not exists public.prices (
  ingredient text primary key,
  item       text,          -- product name at the store
  price      text,          -- as shown, e.g. "$0.88" or "$4.98 / lb"
  size       text,
  link       text,
  source     text not null default 'Fairway',
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);

-- Old plans pointed at the starter recipe list, which is gone. Start fresh and tie plans to the box.
delete from public.meal_plan;
delete from public.activity;
alter table public.meal_plan alter column recipe_id type bigint using recipe_id::bigint;
alter table public.meal_plan drop constraint if exists meal_plan_recipe_fk;
alter table public.meal_plan add constraint meal_plan_recipe_fk foreign key (recipe_id) references public.recipes(id) on delete cascade;
drop table if exists public.cook_log;

-- Activity now stores readable titles so the feed still makes sense if a recipe is removed.
create or replace function public.log_plan_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text; t text;
begin
  if TG_TABLE_NAME = 'meal_plan' then
    d := to_char(coalesce(new.planned_for, old.planned_for), 'Dy Mon FMDD');
    select title into t from recipes where id = coalesce(new.recipe_id, old.recipe_id);
    t := coalesce(t, 'a removed recipe');
    if TG_OP = 'INSERT' then insert into activity(user_id, action, item) values (auth.uid(), 'planned for ' || d, t);
    elsif TG_OP = 'DELETE' then insert into activity(user_id, action, item) values (auth.uid(), 'took off ' || d, t);
    elsif new.cooked_at is not null and old.cooked_at is null then insert into activity(user_id, action, item) values (auth.uid(), 'cooked', t);
    elsif new.planned_for <> old.planned_for then insert into activity(user_id, action, item) values (auth.uid(), 'moved to ' || d, t);
    end if;
  elsif TG_TABLE_NAME = 'recipes' then
    insert into activity(user_id, action, item)
      values (auth.uid(), case when TG_OP = 'INSERT' then 'added to the recipe box' else 'removed from the recipe box' end,
              coalesce(new.title, old.title));
  elsif TG_TABLE_NAME = 'prices' then
    insert into activity(user_id, action, item) values (auth.uid(), 'set the price of', new.ingredient || ' (' || coalesce(new.price,'?') || ')');
  else
    insert into activity(user_id, action, item)
      values (auth.uid(), case when TG_OP = 'INSERT' then 'has at home' else 'needs to buy' end, coalesce(new.ingredient, old.ingredient));
  end if;
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['recipes','prices'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I for all using (public.is_member()) with check (public.is_member())', t);
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
drop trigger if exists recipes_activity on public.recipes;
create trigger recipes_activity after insert or delete on public.recipes for each row execute function public.log_plan_activity();
drop trigger if exists prices_activity on public.prices;
create trigger prices_activity after insert or update on public.prices for each row execute function public.log_plan_activity();

-- Ingredients in the recipe box that don't have a price yet (what Claude looks up on Fairway).
create or replace view public.ingredients_needing_price with (security_invoker = true) as
  select distinct unnest(r.ingredients) as ingredient from public.recipes r
  except select ingredient from public.prices where price is not null;
