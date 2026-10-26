// Who may call an internal Edge Function (code review 2026-10-23, finding #3).
// The anon key ships in every browser, so a valid JWT alone proves nothing.
// Allowed: the scheduled jobs (x-cron-secret = CRON_SECRET), another function
// (Bearer service-role key), or a signed-in, active member of the team.
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function allowedCaller(req: Request, supa: SupabaseClient): Promise<boolean> {
  const cron = Deno.env.get('CRON_SECRET')
  if (cron && req.headers.get('x-cron-secret') === cron) return true

  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return false
  if (jwt === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true

  const { data } = await supa.auth.getUser(jwt)
  if (!data?.user) return false
  const { data: me } = await supa.from('users').select('is_active').eq('id', data.user.id).maybeSingle()
  return me?.is_active === true
}
