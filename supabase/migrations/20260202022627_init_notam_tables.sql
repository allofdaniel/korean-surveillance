-- pg_cron and pg_net setup for NOTAM crawler scheduling

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
GRANT USAGE ON SCHEMA cron TO postgres;

-- Enable pg_net extension (for HTTP calls)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule Edge Function call every 5 minutes
SELECT cron.schedule(
  'notam-crawler-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ugzsuswrazaimvpyloqw.supabase.co/functions/v1/notam-crawler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer notam-crawler-secret-2026'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
