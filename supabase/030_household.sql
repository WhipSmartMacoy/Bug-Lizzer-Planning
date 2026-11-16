-- Bug-Lizzer Planning · 030: household supplies (cleaning, paper goods…), kept apart from food.
-- Marking an item low or out puts it on the shopping list; buying it marks it stocked again.
create table if not exists public.household_items (
  id          bigint generated always as identity primary key,
  name        text not null unique,
  category    text not null default 'other',
  status      text not null default 'stocked' check (status in ('stocked','low','out')),
  price       text,
  last_bought timestamptz,
  updated_by  uuid,
  updated_at  timestamptz not null default now()
);
alter table public.household_items enable row level security;
drop policy if exists "members manage household items" on public.household_items;
create policy "members manage household items" on public.household_items for all to authenticated
  using (public.is_member()) with check (public.is_member());

alter publication supabase_realtime add table public.household_items;   -- live updates for both of you
