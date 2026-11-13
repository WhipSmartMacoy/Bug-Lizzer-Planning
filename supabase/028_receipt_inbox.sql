-- Bug-Lizzer Planning · 028: Fairway email receipts.
-- Home Assistant reads the Gmail inbox and drops each Fairway receipt here; the app shows it for review
-- and adds what you confirm to At Home.
create table if not exists public.receipt_inbox (
  id          bigint generated always as identity primary key,
  received_at timestamptz not null default now(),
  sender      text,
  subject     text,
  body        text,
  handled_at  timestamptz,
  handled_by  uuid
);
alter table public.receipt_inbox enable row level security;
drop policy if exists "members read receipts" on public.receipt_inbox;
create policy "members read receipts" on public.receipt_inbox for select to authenticated using (public.is_member());
drop policy if exists "members handle receipts" on public.receipt_inbox;
create policy "members handle receipts" on public.receipt_inbox for update to authenticated using (public.is_member()) with check (public.is_member());

create or replace function public.ha_receipt(p_sender text, p_subject text, p_body text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not ha_ok() then raise exception 'not allowed' using errcode = '42501'; end if;
  -- the same email can be reported twice (e.g. after a restart): keep one
  if exists (select 1 from receipt_inbox where md5(coalesce(body,'')) = md5(coalesce(p_body,'')) and received_at > now() - interval '60 days') then
    return json_build_object('ok', true, 'duplicate', true);
  end if;
  insert into receipt_inbox(sender, subject, body) values (left(p_sender, 300), left(p_subject, 300), left(p_body, 200000));
  return json_build_object('ok', true);
end $$;
revoke all on function public.ha_receipt(text, text, text) from public;
grant execute on function public.ha_receipt(text, text, text) to anon;
