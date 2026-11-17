-- Morning recipe search moves to 6:30 am New York time (10:30 / 11:30 UTC; the function runs only the
-- one that is 6:30 there). The Home Assistant laptop searches Allrecipes and Serious Eats at 6:30 too.
select cron.unschedule('bug-lizzer-daily-ideas') where exists (select 1 from cron.job where jobname = 'bug-lizzer-daily-ideas');
select cron.schedule('bug-lizzer-daily-ideas', '30 10,11 * * *', $$
  select net.http_post(
    url := 'https://ndbanzpiwhaqvtsepszf.supabase.co/functions/v1/find-recipes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-daily-key', (select key from public.daily_job_key limit 1)),
    timeout_milliseconds := 20000);
$$);
