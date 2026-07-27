// Shipping-email intake (Sprint 12, owner request 2026-07-17).
// Zapier (filtered inbox or forwarding address) POSTs the email here; tracking
// numbers are regex-extracted and stored for human matching on the Ordering
// dashboard's Tracking tab. Deliberately no mailbox access — only what Zapier
// forwards ever reaches this function.
// Deployed with --no-verify-jwt; the shared secret is the gate.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Carrier = 'ups' | 'fedex' | 'usps'

// One pass, longest shapes first so boundaries keep a 22-digit USPS number
// from also surfacing its 12-digit substring as FedEx.
const TRACKING_RE = /\b1Z[0-9A-Z]{16}\b|\b\d{20,22}\b|\b\d{15}\b|\b\d{12}\b/g

function classify(num: string): Carrier {
  if (/^1Z/i.test(num)) return 'ups'
  if (num.length >= 20) return 'usps'
  return 'fedex' // 12 or 15 digits
}

const field = (o: Record<string, unknown>, ...names: string[]): string => {
  for (const n of names) {
    const v = o[n]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

Deno.serve(async (req) => {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  const secret = Deno.env.get('EMAIL_WEBHOOK_SECRET')
  const given = new URL(req.url).searchParams.get('secret') ?? req.headers.get('x-webhook-secret')
  if (!secret || given !== secret) return json({ ok: false, error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'expected JSON body' }, 400)
  }

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await supa.from('webhook_events').insert({ source: 'email', payload: body, processed: true })

  const sender = field(body, 'from', 'from_email', 'sender', 'From')
  const subject = field(body, 'subject', 'Subject')
  const plain = field(body, 'body_plain', 'body', 'text', 'body_text')
  const html = field(body, 'body_html', 'html')
  const emailDate = field(body, 'date', 'received_at', 'Date')

  // Tags out, entities that hide numbers (e.g. &nbsp; between digits) to space.
  const fromHtml = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ')
  const text = `${subject}\n${plain}\n${fromHtml}`

  const found = [...new Set((text.match(TRACKING_RE) ?? []).map((n) => n.toUpperCase()))]
  let inserted = 0
  for (const num of found) {
    const { data, error } = await supa
      .from('tracking_numbers')
      .upsert(
        {
          tracking_number: num,
          carrier: classify(num),
          sender: sender || null,
          subject: subject || null,
          email_date: emailDate && !isNaN(Date.parse(emailDate)) ? new Date(emailDate).toISOString() : new Date().toISOString(),
        },
        { onConflict: 'tracking_number', ignoreDuplicates: true },
      )
      .select('id') // duplicates return no row, so this counts only real inserts
    if (!error && (data?.length ?? 0) > 0) inserted++
  }
  return json({ ok: true, found: found.length, stored: inserted })
})
