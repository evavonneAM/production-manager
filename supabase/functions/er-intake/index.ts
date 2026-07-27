// Estimate Rocket webhook intake (Sprint 12).
// Capture-only for now: every payload is logged verbatim to webhook_events so
// the real Zapier payload shape can be inspected before the project/job
// mapping is built (BUILD_PLAN: "First, inspect the real Zapier payload").
// Deployed with --no-verify-jwt; the shared secret is the gate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  const secret = Deno.env.get('ER_WEBHOOK_SECRET')
  const given = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-webhook-secret')
  if (!secret || given !== secret) return json({ ok: false, error: 'unauthorized' }, 401)

  let payload: unknown
  const raw = await req.text()
  try {
    payload = JSON.parse(raw)
  } catch {
    payload = { _raw: raw } // Zapier misconfigured as form/text — keep it anyway.
  }

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await supa.from('webhook_events').insert({ source: 'estimate_rocket', payload })
  if (error) return json({ ok: false, error: error.message }, 500)
  return json({ ok: true, captured: true })
})
