-- Bug-Lizzer Planning · 021: LG TV commands, carried out by the bridge program on the home PC
-- Only the `tv` function (service role) touches this table.
create table if not exists public.tv_commands (
  id         bigint generated always as identity primary key,
  cmd        text not null,
  args       jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  taken_at   timestamptz,
  done_at    timestamptz,
  result     text
);
alter table public.tv_commands enable row level security;
