-- Bug-Lizzer Planning: how much each recipe uses, and what's left in the kitchen.
-- recipes.amounts: { "<ingredient>": { "q": <number>, "u": "ml" | "g" | "each" | "pkg" } }
--   ml = volume, g = weight, each = whole items (1 lemon, 1 garlic bulb), pkg = "1 package/can/jar".
alter table public.recipes add column if not exists amounts jsonb not null default '{}'::jsonb;

-- What the household has on hand, in the same base units.
create table if not exists public.pantry (
  ingredient text primary key,
  q          numeric not null default 0,
  u          text not null default 'each' check (u in ('ml','g','each','pkg')),
  updated_by uuid default auth.uid() references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.pantry enable row level security;
drop policy if exists "members only" on public.pantry;
create policy "members only" on public.pantry for all using (public.is_member()) with check (public.is_member());
do $$ begin
  alter publication supabase_realtime add table public.pantry;
exception when duplicate_object then null; end $$;

-- Remember how much was bought so "undo" takes back exactly that.
alter table public.week_have add column if not exists bought_q numeric;
alter table public.week_have add column if not exists bought_u text;
