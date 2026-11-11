-- Bug-Lizzer Planning: recipes are either "new" (not cooked yet) or "past" (cooked before).
-- Cooking a new recipe from the planner moves it to "past" automatically.

alter table public.recipes add column if not exists status text not null default 'new';
alter table public.recipes drop constraint if exists recipes_status_check;
alter table public.recipes add constraint recipes_status_check check (status in ('new','past'));

create or replace function public.mark_recipe_past() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.cooked_at is not null and (old.cooked_at is null) then
    update recipes set status = 'past' where id = new.recipe_id and status <> 'past';
  end if;
  return new;
end $$;
drop trigger if exists meal_plan_mark_past on public.meal_plan;
create trigger meal_plan_mark_past after update on public.meal_plan
  for each row execute function public.mark_recipe_past();

-- Say which kind was added in the activity feed.
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
      values (auth.uid(),
              case when TG_OP = 'DELETE' then 'removed from the recipe box'
                   when new.status = 'past' then 'added a past recipe'
                   else 'added a new recipe to try' end,
              coalesce(new.title, old.title));
  elsif TG_TABLE_NAME = 'prices' then
    insert into activity(user_id, action, item) values (auth.uid(), 'set the price of', new.ingredient || ' (' || coalesce(new.price,'?') || ')');
  else
    insert into activity(user_id, action, item)
      values (auth.uid(), case when TG_OP = 'INSERT' then 'has at home' else 'needs to buy' end, coalesce(new.ingredient, old.ingredient));
  end if;
  return coalesce(new, old);
end $$;
