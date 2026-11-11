-- Bug-Lizzer Planning: support the "Refresh prices" button.
alter table public.prices add column if not exists available boolean not null default true;
alter table public.prices add column if not exists checked_at timestamptz;

-- Automatic Fairway refreshes write one summary line to the feed (from the function itself),
-- so only prices a household member sets by hand get their own activity line.
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
    if new.source = 'Household' and auth.uid() is not null then
      insert into activity(user_id, action, item) values (auth.uid(), 'set the price of', new.ingredient || ' (' || coalesce(new.price,'?') || ')');
    end if;
  else
    insert into activity(user_id, action, item)
      values (auth.uid(), case when TG_OP = 'INSERT' then 'has at home' else 'needs to buy' end, coalesce(new.ingredient, old.ingredient));
  end if;
  return coalesce(new, old);
end $$;
