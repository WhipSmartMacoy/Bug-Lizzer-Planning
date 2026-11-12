-- Bug-Lizzer Planning · 020: Philips Hue link (cloud / Remote API)
-- Tokens are only ever read and written by the `hue` function (service role). No policies = no app access.
create table if not exists public.hue_link (
  id            int primary key default 1 check (id = 1),
  access_token  text,
  refresh_token text,
  expires_at    timestamptz,
  app_key       text,
  pending_state text,
  linked_by     uuid,
  updated_at    timestamptz not null default now()
);
alter table public.hue_link enable row level security;
