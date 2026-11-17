-- Daily 7 am recipe ideas: Supabase runs the web search on its own each morning and saves the
-- results (app_settings key 'web_ideas'), so Cook opens with them straight away.
-- The app saves what's At Home to app_settings key 'web_input'; the search reads it from there.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A random key only this database and the search function know (never in the repo).
-- RLS on with no policies: nobody signed in can read it; the function reads it with its service role.
create table if not exists public.daily_job_key (key text not null);
alter table public.daily_job_key enable row level security;
insert into public.daily_job_key (key)
  select replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') where not exists (select 1 from public.daily_job_key);

-- 11:00 and 12:00 UTC; the function only runs the one that is 7 am in New York (handles daylight saving).
select cron.unschedule('bug-lizzer-daily-ideas') where exists (select 1 from cron.job where jobname = 'bug-lizzer-daily-ideas');
select cron.schedule('bug-lizzer-daily-ideas', '0 11,12 * * *', $$
  select net.http_post(
    url := 'https://ndbanzpiwhaqvtsepszf.supabase.co/functions/v1/find-recipes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-daily-key', (select key from public.daily_job_key limit 1)),
    timeout_milliseconds := 20000);
$$);
