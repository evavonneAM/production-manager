-- Sprint 9 — run the sheets-sync reconcile every 5 minutes (SPEC §12).
-- Uses pg_cron (enabled in Sprint 4) + pg_net for the HTTP call. The Bearer
-- token below is the project's *anon* key — public by design (it shipped in
-- every browser bundle); it only satisfies the function gateway's JWT check.
-- Best-effort: if pg_net is unavailable, the app-side triggers ("Sync Now" +
-- sync-after-each-change) still keep the sheet current.
do $$
begin
  create extension if not exists pg_net;
  perform cron.schedule(
    'sheets-sync-5min',
    '*/5 * * * *',
    $cron$
    select net.http_post(
      url     := 'https://yjqlmypzwchwsjemgqsy.supabase.co/functions/v1/sheets-sync',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWxteXB6d2Nod3NqZW1ncXN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjAzMTAsImV4cCI6MjA5NzI5NjMxMH0.dcQqSLXyR7aYvRQqK5lsLUEXg5p7BNHJ8HTRKJPW3oE"}'::jsonb,
      body    := '{}'::jsonb
    );
    $cron$
  );
  raise notice 'sheets-sync cron scheduled (every 5 min)';
exception when others then
  raise notice 'could not schedule sheets-sync cron (non-fatal): %', sqlerrm;
end $$;
