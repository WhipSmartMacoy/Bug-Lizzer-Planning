-- Bug-Lizzer Planning · 014: nutrition goals per person
-- Body stats used to work out daily targets (Mifflin-St Jeor). Age and activity are editable in Settings.
create table if not exists public.people (
  name       text primary key,
  sex        text not null check (sex in ('female','male')),
  height_in  numeric not null,
  weight_lb  numeric not null,
  goal       text not null default 'maintain' check (goal in ('maintain','lose','gain')),
  goal_lb    numeric,
  age        int not null default 30,
  born       date,                       -- birth month; age is worked out from it
  activity   text not null default 'light' check (activity in ('sedentary','light','moderate','active')),
  updated_at timestamptz not null default now()
);
alter table public.people enable row level security;
drop policy if exists "members read people" on public.people;
drop policy if exists "members write people" on public.people;
create policy "members read people"  on public.people for select using (public.is_member());
create policy "members write people" on public.people for all using (public.is_member()) with check (public.is_member());
insert into public.people (name, sex, height_in, weight_lb, goal, goal_lb, born, activity) values
  ('Amy',    'female', 66, 115, 'maintain', 115, '1995-05-01', 'moderate'),
  ('Parker', 'male',   74, 205, 'lose',     190, '1992-10-01', 'moderate')
on conflict (name) do nothing;
