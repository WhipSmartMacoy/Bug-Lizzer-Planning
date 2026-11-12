-- Bug-Lizzer Planning · 015: breakfast (same as lunch: one person's meal — cooked, leftovers, or out)
alter table public.meal_plan drop constraint if exists meal_plan_meal_check;
alter table public.meal_plan add constraint meal_plan_meal_check check (meal in ('breakfast','lunch','dinner'));

create or replace function public.log_plan_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text; t text;
begin
  if TG_TABLE_NAME = 'meal_plan' then
    d := to_char(coalesce(new.planned_for, old.planned_for), 'Dy Mon FMDD');
    select title into t from recipes where id = coalesce(new.recipe_id, old.recipe_id);
    if coalesce(new.meal, old.meal) in ('lunch','breakfast') then
      t := coalesce(new.person, old.person) || '''s ' || coalesce(new.meal, old.meal) || ': ' || coalesce(t, case when coalesce(new.recipe_id, old.recipe_id) is null then 'out' || coalesce(' (' || coalesce(new.note, old.note) || ')', '') end, 'a removed recipe');
    end if;
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
