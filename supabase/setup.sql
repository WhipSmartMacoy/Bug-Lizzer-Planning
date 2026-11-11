-- Bug-Lizzer Planning: shared household data with per-person sign-in.
-- Run once in Supabase → SQL Editor. Safe to re-run.

-- ---------- Members ----------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  approved   boolean not null default false,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Is the current user an approved household member?
create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and approved);
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members where user_id = auth.uid() and approved and is_admin);
$$;

-- The very first person to join becomes the approved admin; everyone after waits for approval.
create or replace function public.first_member_is_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members) then
    new.approved := true; new.is_admin := true;
  else
    new.approved := false; new.is_admin := false;
  end if;
  return new;
end $$;
drop trigger if exists members_first_admin on public.members;
create trigger members_first_admin before insert on public.members
  for each row execute function public.first_member_is_admin();

-- Stop non-admins from approving themselves or making themselves admin.
create or replace function public.guard_member_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.approved := old.approved; new.is_admin := old.is_admin;
  end if;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before update on public.members
  for each row execute function public.guard_member_update();

alter table public.members enable row level security;
drop policy if exists "members: see household" on public.members;
create policy "members: see household" on public.members for select
  using (user_id = auth.uid() or public.is_member());
drop policy if exists "members: join" on public.members;
create policy "members: join" on public.members for insert
  with check (user_id = auth.uid());
drop policy if exists "members: edit self or admin" on public.members;
create policy "members: edit self or admin" on public.members for update
  using (user_id = auth.uid() or public.is_admin());
drop policy if exists "members: admin removes" on public.members;
create policy "members: admin removes" on public.members for delete
  using (public.is_admin() and user_id <> auth.uid());

-- ---------- Kitchen data ----------
create table if not exists public.cook_log (
  id         bigint generated always as identity primary key,
  recipe_id  text not null,
  cooked_on  date not null default current_date,
  user_id    uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create table if not exists public.week_plan (
  recipe_id  text primary key,
  added_by   uuid not null default auth.uid() references auth.users(id),
  added_at   timestamptz not null default now()
);
create table if not exists public.have_at_home (
  ingredient text primary key,
  marked_by  uuid not null default auth.uid() references auth.users(id),
  marked_at  timestamptz not null default now()
);

-- ---------- Activity feed: who did what ----------
create table if not exists public.activity (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id),
  action     text not null,
  item       text not null,
  created_at timestamptz not null default now()
);

create or replace function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare a text; i text;
begin
  if TG_TABLE_NAME = 'cook_log' then
    a := case when TG_OP = 'INSERT' then 'cooked' else 'removed a cook of' end;
    i := coalesce(new.recipe_id, old.recipe_id);
  elsif TG_TABLE_NAME = 'week_plan' then
    a := case when TG_OP = 'INSERT' then 'added to this week' else 'removed from this week' end;
    i := coalesce(new.recipe_id, old.recipe_id);
  elsif TG_TABLE_NAME = 'have_at_home' then
    a := case when TG_OP = 'INSERT' then 'has at home' else 'needs to buy' end;
    i := coalesce(new.ingredient, old.ingredient);
  end if;
  insert into activity(user_id, action, item) values (auth.uid(), a, i);
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['cook_log','week_plan','have_at_home'] loop
    execute format('drop trigger if exists %I_activity on public.%I', t, t);
    execute format('create trigger %I_activity after insert or delete on public.%I for each row execute function public.log_activity()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "members only" on public.%I', t);
    execute format('create policy "members only" on public.%I for all using (public.is_member()) with check (public.is_member())', t);
  end loop;
end $$;

alter table public.activity enable row level security;
drop policy if exists "members read" on public.activity;
create policy "members read" on public.activity for select using (public.is_member());

-- Live updates on everyone's screen
do $$ declare t text; begin
  foreach t in array array['cook_log','week_plan','have_at_home','activity','members'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
