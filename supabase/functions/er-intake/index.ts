// Estimate Rocket webhook intake (Sprint 12).
// Two modes:
//  - Zapier POST (?secret=…&store=AM|HOV|RHU): log the payload verbatim to
//    webhook_events, then process it. Only projects whose state has become
//    "Work Order" (an accepted estimate) create anything; estimates still in
//    negotiation are logged and skipped. Updates never regress production
//    state — an existing project only gets its name/client refreshed.
//  - App POST {resync:true} with an admin JWT: re-process every unprocessed
//    logged event (the manual "Re-sync" button; also imports events that
//    arrived before processing existed).
// Job codes: store prefix + last 4 digits of the ER estimate number
// (owner decision 2026-07-27), e.g. 2606-2217-8655 @ HOV → HOV8655.
// Deployed with --no-verify-jwt; the shared secret / verified JWT is the gate.
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const STORES = ['AM', 'HOV', 'RHU']

// Each store's slug on customerportal.estimaterocket.com (owner-provided).
// URL shape: /<slug>/<client customer_portal_token>/<estimate number>
const PORTAL_SLUGS: Record<string, string> = {
  HOV: 'houseofvonne',
  AM: 'alexandermatthews',
  RHU: 'rhupholstery',
}

function portalUrl(store: string, token: unknown, number: unknown): string | null {
  const slug = PORTAL_SLUGS[store]
  if (!slug || !token || !number) return null
  return `https://customerportal.estimaterocket.com/${slug}/${token}/${number}`
}

// ---- Line-item extraction from the portal proposal document -----------------
// The client-facing proposal page is public (tokenized) and server-rendered
// with semantic classes (.line-item-name/-description/-unit-price/…), so the
// same document the client signs is the line-item source. Best-effort: if the
// page shape ever changes, imports continue and only suggestions are skipped.

type LineItem = { name: string; description: string | null; quantity: number | null; unit_price: number | null; total: number | null }

const htmlToText = (s: string): string =>
  s
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|ul|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()

const num = (s: string | null): number | null => {
  if (!s) return null
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

const grab = (row: string, cls: string): string | null => {
  const m = row.match(new RegExp(`<div class="${cls}"[^>]*>([\\s\\S]*?)</div>`))
  return m ? m[1] : null
}

function parseLineItems(html: string): LineItem[] {
  const items: LineItem[] = []
  for (const row of html.match(/<tr class="line-item [\s\S]*?<\/tr>/g) ?? []) {
    const name = htmlToText(grab(row, 'line-item-name') ?? '')
    if (!name) continue
    // The description div nests markup; capture up to the cell boundary.
    const descM = row.match(/<div class="line-item-description"[^>]*>([\s\S]*?)<\/td>/)
    const description = descM ? htmlToText(descM[1]) : ''
    items.push({
      name,
      description: description || null,
      quantity: num(grab(row, 'line-item-quantity')),
      unit_price: num(grab(row, 'line-item-unit-price')),
      total: num(grab(row, 'line-item-total')),
    })
  }
  return items
}

/** Fetch + parse the proposal document once per proposal; store suggestions. */
async function ingestLineItems(
  supa: SupabaseClient,
  projectId: string,
  store: string,
  token: unknown,
  proposalId: unknown,
): Promise<string> {
  const slug = PORTAL_SLUGS[store]
  if (!slug || !token || !proposalId) return 'no portal data'
  const { data: seen } = await supa.from('er_line_items').select('id').eq('proposal_id', String(proposalId)).limit(1)
  if (seen && seen.length > 0) return 'already ingested'

  try {
    const res = await fetch(
      `https://customerportal.estimaterocket.com/${slug}/${token}/proposals/${proposalId}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return `portal fetch ${res.status}`
    const items = parseLineItems(await res.text())
    if (items.length === 0) return 'no line items found'
    const { error } = await supa.from('er_line_items').insert(
      items.map((it, i) => ({ ...it, project_id: projectId, proposal_id: String(proposalId), position: i })),
    )
    return error ? `line items insert: ${error.message}` : `${items.length} line items`
  } catch (e) {
    return `portal fetch failed: ${String(e).slice(0, 100)}`
  }
}
// Every new job gets the full pipeline (per-job routing editor is deferred).
const ROUTING = ['Design', 'Procurement', 'Stripping', 'Carpentry', 'Foam', 'Sewing', 'Upholstering', 'Installation']

type Ev = { id: string; store: string | null; payload: Record<string, unknown> }
type Outcome = { result: 'created' | 'updated' | 'skipped' | 'failed'; note: string }

async function processEvent(supa: SupabaseClient, ev: Ev): Promise<Outcome> {
  // deno-lint-ignore no-explicit-any
  const p = (ev.payload as any)?.project
  if (!ev.store) return { result: 'skipped', note: 'no store tag on webhook URL' }
  if (!p?.id) return { result: 'skipped', note: 'no project in payload' }
  if (p.project_state_type !== 'Work Order')
    return { result: 'skipped', note: `state is "${p.project_state_type}", not an accepted work order` }

  const last4 = String(p.number ?? '').replace(/\D/g, '').slice(-4)
  if (last4.length < 4) return { result: 'failed', note: `no usable estimate number ("${p.number}")` }
  const wo = ev.store + last4

  const client = p.client ?? {}
  const clientName: string =
    (client.company_name || `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || 'Unknown client') as string
  const projName: string = (String(p.name ?? '').trim() || clientName) as string
  const notes = String(p.customer_notes ?? '').trim() || null

  const portal = portalUrl(ev.store, client.customer_portal_token, p.number)

  const { data: existing } = await supa
    .from('projects')
    .select('id, name, client_name, er_portal_url')
    .eq('estimate_rocket_id', String(p.id))
    .maybeSingle()

  if (existing) {
    // Refresh identity fields only; production state is never touched from ER.
    // A change order (new accepted proposal) still adds its line-item suggestions.
    const liNote = await ingestLineItems(supa, existing.id, ev.store, client.customer_portal_token, (ev.payload as any).id)
    const nextPortal = portal ?? existing.er_portal_url
    if (existing.name !== projName || existing.client_name !== clientName || existing.er_portal_url !== nextPortal) {
      await supa
        .from('projects')
        .update({ name: projName, client_name: clientName, er_portal_url: nextPortal })
        .eq('id', existing.id)
      return { result: 'updated', note: `${wo}: name/client/portal refreshed; items: ${liNote}` }
    }
    return { result: 'skipped', note: `${wo}: already imported (items: ${liNote})` }
  }

  // Last-4 collision (two estimates sharing final digits): surface, don't guess.
  const { data: clash } = await supa.from('projects').select('id').eq('work_order_number', wo).maybeSingle()
  if (clash) return { result: 'failed', note: `job code ${wo} already belongs to another project` }

  const { data: proj, error: projErr } = await supa
    .from('projects')
    .insert({
      name: projName,
      client_name: clientName,
      work_order_number: wo,
      estimate_rocket_id: String(p.id),
      description: notes,
      status: 'estimate',
      er_portal_url: portal,
    })
    .select('id')
    .single()
  if (projErr) return { result: 'failed', note: `project insert: ${projErr.message}` }

  const { data: job, error: jobErr } = await supa
    .from('jobs')
    .insert({ project_id: proj.id, job_code: wo, name: projName, description: notes })
    .select('id')
    .single()
  if (jobErr) return { result: 'failed', note: `job insert: ${jobErr.message}` }

  const { data: depts, error: deptErr } = await supa.from('departments').select('id, name')
  if (deptErr) return { result: 'failed', note: `departments: ${deptErr.message}` }
  const deptId = Object.fromEntries((depts ?? []).map((d) => [d.name, d.id]))

  const stageRows = ROUTING.map((name, i) => ({
    job_id: job.id,
    department_id: deptId[name],
    sequence: i + 1,
    status: i === 0 ? 'queued' : 'upcoming',
    entered_at: i === 0 ? new Date().toISOString() : null,
  }))
  const { data: stages, error: stageErr } = await supa.from('job_stages').insert(stageRows).select('id, sequence')
  if (stageErr) return { result: 'failed', note: `stages insert: ${stageErr.message}` }

  const first = (stages ?? []).find((s) => s.sequence === 1)
  await supa.from('jobs').update({ current_stage_id: first?.id }).eq('id', job.id)
  // Slot the new job into the Design queue by company priority.
  await supa.rpc('_resequence_department_queue', { p_department_id: deptId['Design'] })

  // Names flow through the usual translate-on-write path (fire and forget).
  supa.functions.invoke('translate', { body: { table: 'projects', id: proj.id } }).catch(() => {})
  supa.functions.invoke('translate', { body: { table: 'jobs', id: job.id } }).catch(() => {})

  const liNote = await ingestLineItems(supa, proj.id, ev.store, client.customer_portal_token, (ev.payload as any).id)

  const { data: admins } = await supa.from('users').select('id').eq('role', 'admin')
  for (const a of admins ?? []) {
    await supa.rpc('_notify', {
      p_user_id: a.id,
      p_type: 'project_created',
      p_title_en: `New work order ${wo}`,
      p_title_ru: `Новый заказ ${wo}`,
      p_title_es: `Nuevo pedido ${wo}`,
      p_body_en: `${clientName} · ${projName} — from Estimate Rocket`,
      p_body_ru: `${clientName} · ${projName} — из Estimate Rocket`,
      p_body_es: `${clientName} · ${projName} — de Estimate Rocket`,
      p_job_id: job.id,
    })
  }
  return { result: 'created', note: `${wo}: project + job created; items: ${liNote}` }
}

async function finishEvent(supa: SupabaseClient, evId: string, o: Outcome) {
  await supa
    .from('webhook_events')
    .update({ processed: o.result !== 'failed', error: o.result === 'created' ? null : o.note })
    .eq('id', evId)
}

Deno.serve(async (req) => {
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const params = new URL(req.url).searchParams

  const raw = await req.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    body = { _raw: raw }
  }

  // ---- Re-sync mode: admin JWT, reprocess everything unprocessed -------------
  if (body.resync === true) {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: auth } = await supa.auth.getUser(jwt)
    if (!auth?.user) return json({ ok: false, error: 'unauthorized' }, 401)
    const { data: me } = await supa.from('users').select('role').eq('id', auth.user.id).maybeSingle()
    if (me?.role !== 'admin') return json({ ok: false, error: 'not_eligible' }, 403)

    const { data: pending } = await supa
      .from('webhook_events')
      .select('id, store, payload')
      .eq('source', 'estimate_rocket')
      .eq('processed', false)
      .order('received_at', { ascending: true })

    const counts = { created: 0, updated: 0, skipped: 0, failed: 0 }
    const details: string[] = []
    for (const ev of (pending ?? []) as Ev[]) {
      const o = await processEvent(supa, ev)
      await finishEvent(supa, ev.id, o)
      counts[o.result]++
      details.push(`${o.result}: ${o.note}`)
    }
    return json({ ok: true, ...counts, details })
  }

  // ---- Zapier mode: shared secret ------------------------------------------
  const secret = Deno.env.get('ER_WEBHOOK_SECRET')
  const given = params.get('secret') ?? req.headers.get('x-webhook-secret')
  if (!secret || given !== secret) return json({ ok: false, error: 'unauthorized' }, 401)

  const store = params.get('store')?.toUpperCase() ?? null
  if (store && !STORES.includes(store)) return json({ ok: false, error: 'unknown store' }, 400)

  const { data: ev, error } = await supa
    .from('webhook_events')
    .insert({ source: 'estimate_rocket', store, payload: body })
    .select('id')
    .single()
  if (error) return json({ ok: false, error: error.message }, 500)

  const outcome = await processEvent(supa, { id: ev.id, store, payload: body })
  await finishEvent(supa, ev.id, outcome)
  return json({ ok: true, captured: true, [outcome.result]: true, note: outcome.note })
})
