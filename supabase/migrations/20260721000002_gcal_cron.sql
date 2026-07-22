-- Sprint 11 — run the Google Calendar sync every 15 minutes (same pattern as
-- the sheets-sync cron; the Bearer token is the public-by-design anon key).
do $$
begin
  perform cron.schedule(
    'gcal-sync-15min',
    '*/15 * * * *',
    $cron$
    select net.http_post(
      url     := 'https://yjqlmypzwchwsjemgqsy.supabase.co/functions/v1/gcal-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWxteXB6d2Nod3NqZW1ncXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAzMTAsImV4cCI6MjA5NzI5NjMxMH0.dcQqSLXyR7aYvRQqK5lsLUEXg5p7BNHJ8HTRKJPW3oE"}'::jsonb,
      body    := '{}'::jsonb
    );
    $cron$
  );
  raise notice 'gcal-sync cron scheduled (every 15 min)';
exception when others then
  raise notice 'could not schedule gcal-sync cron (non-fatal): %', sqlerrm;
end $$;
