# Deploying review round 1

The app part (page hiding) goes live on merge, like every change. The database and
background-job parts need these steps once, from a computer with the Supabase CLI signed in
to the project (`yjqlmypzwchwsjemgqsy`). Do them in this order, in one sitting, so the
5-minute Sheets sync and 15-minute Calendar sync are never left without their secret.

1. Make a random secret and give it to the functions:
   `CRON_SECRET=$(openssl rand -hex 32)` then
   `supabase secrets set CRON_SECRET="$CRON_SECRET"`.
2. Give the same secret to the scheduled jobs (Vault). In the SQL editor, or with
   `supabase db query`: `select vault.create_secret('<the secret>', 'cron_secret');`
3. Deploy the three functions: `supabase functions deploy sheets-sync gcal-sync translate`.
4. Apply the migration: `supabase db push` (adds `20261023000001_review_round_1.sql`).
5. Check: the next Sheets sync run succeeds (Edge Function logs show 200, not 401), and a
   request to `translate` with only the public key gets 401.

Delete this file once round 1 is live.
