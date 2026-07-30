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

// No prices: the production app must never show money (owner requirement),
// so unit price / total are deliberately not extracted or stored.
type LineItem = { name: string; description: string | null; quantity: number | null }

const htmlToText = (s: string): string =>
  s
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<\/(p|ul|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/•\n/g, '• ') // bullet marker must stay glued to its text
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
  // ER's templates vary and may legally omit closing </td>/</tr>, so split on
  // row starts instead of matching whole rows, and bound the description by
  // the next structural marker rather than a closing tag.
  const segments = html.split(/<tr class="line-item /).slice(1)
  for (let seg of segments) {
    const cut = seg.search(/<\/tbody>|<tfoot|<table class="total/)
    if (cut !== -1) seg = seg.slice(0, cut)
    const name = htmlToText(grab(seg, 'line-item-name') ?? '')
    if (!name) continue
    const descM = seg.match(
      /<div class="line-item-description"[^>]*>([\s\S]*?)(?=<\/td>|<td[ >]|<div class="line-item-(?:unit-price|quantity|total))/,
    )
    let description = descM ? htmlToText(descM[1]) : ''
    // No-prices rule, defense in depth: drop any line carrying a money amount.
    description = description
      .split('\n')
      .filter((l) => !/\$\s?\d/.test(l))
      .join('\n')
      .trim()
    items.push({
      name,
      description: description || null,
      quantity: num(grab(seg, 'line-item-quantity')),
    })
  }
  return items
}

/** Line items + the official proposal PDF, for every proposal we can see.
 *  Proposal events name their proposal directly; assignment events carry
 *  assignment ids, so the portal landing page is scanned instead. */
async function enrichFromProposals(
  supa: SupabaseClient,
  projectId: string,
  ev: Ev,
  // deno-lint-ignore no-explicit-any
  p: any,
  // deno-lint-ignore no-explicit-any
  client: any,
  wo: string,
): Promise<string> {
  const slug = PORTAL_SLUGS[ev.store ?? '']
  const token = client?.customer_portal_token
  if (!slug || !token) return 'no portal data'
  const isProposal = (ev.payload as Record<string, unknown>).status !== undefined
  const ids = isProposal
    ? [String((ev.payload as Record<string, unknown>).id)]
    : await discoverProposalIds(slug, token, p.number)
  if (ids.length === 0) return 'no proposals found'
  const notes: string[] = []
  for (const id of ids) {
    notes.push(await ingestLineItems(supa, projectId, ev.store!, token, id))
    notes.push(await attachProposalPdf(supa, projectId, slug, token, id, wo))
  }
  return notes.join('; ')
}

/** Assignment events carry assignment ids, not proposal ids — discover the
 *  project's proposals from its portal landing page instead. */
async function discoverProposalIds(slug: string, token: unknown, number: unknown): Promise<string[]> {
  try {
    const res = await fetch(`https://customerportal.estimaterocket.com/${slug}/${token}/${number}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const html = await res.text()
    return [...new Set([...html.matchAll(/\/proposals\/([0-9a-f-]{36})/g)].map((m) => m[1]))]
  } catch {
    return []
  }
}

/** Attach the official proposal document (public portal PDF) to the project's
 *  Files tab — the "actual work order" the owner asked for. Once per proposal. */
async function attachProposalPdf(
  supa: SupabaseClient,
  projectId: string,
  slug: string,
  token: unknown,
  proposalId: string,
  wo: string,
): Promise<string> {
  const path = `projects/${projectId}/wo-${proposalId}.pdf`
  const { data: seen } = await supa.from('files').select('id').eq('storage_path', path).limit(1)
  if (seen && seen.length > 0) return 'pdf already attached'
  try {
    const res = await fetch(
      `https://customerportal.estimaterocket.com/${slug}/${token}/proposals/${proposalId}/preview.pdf?download=true`,
      { signal: AbortSignal.timeout(20000) },
    )
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('pdf')) return `pdf fetch ${res.status}`
    const bytes = new Uint8Array(await res.arrayBuffer())
    const up = await supa.storage.from('files').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (up.error) return `pdf upload: ${up.error.message}`
    const { data: admin } = await supa.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle()
    if (!admin) return 'no admin user for upload attribution'
    // First proposal is "the work order"; later ones are change orders.
    const { data: prior } = await supa
      .from('files')
      .select('id')
      .eq('project_id', projectId)
      .like('storage_path', 'projects/%/wo-%.pdf')
      .limit(1)
    const fileName =
      prior && prior.length > 0
        ? `Change order ${wo} (${proposalId.slice(0, 4)}).pdf`
        : `Work order ${wo}.pdf`
    const { error } = await supa.from('files').insert({
      project_id: projectId,
      uploaded_by: admin.id,
      file_name: fileName,
      file_type: 'pdf',
      storage_path: path,
      file_size_bytes: bytes.length,
      admin_only: true, // priced client document — no-prices rule
    })
    return error ? `files row: ${error.message}` : 'pdf attached'
  } catch (e) {
    return `pdf fetch failed: ${String(e).slice(0, 80)}`
  }
}

/** Fetch + parse the proposal document and reconcile with what's stored:
 *  changed items update, new items appear, vanished *suggested* items go —
 *  accepted (task/material created) and dismissed items are never touched. */
async function ingestLineItems(
  supa: SupabaseClient,
  projectId: string,
  store: string,
  token: unknown,
  proposalId: unknown,
): Promise<string> {
  const slug = PORTAL_SLUGS[store]
  if (!slug || !token || !proposalId) return 'no portal data'
  const pid = String(proposalId)

  try {
    const res = await fetch(
      `https://customerportal.estimaterocket.com/${slug}/${token}/proposals/${pid}`,
      { signal: AbortSignal.timeout(10000) },
    )
    if (!res.ok) return `portal fetch ${res.status}`
    const html = await res.text()
    const items = parseLineItems(html)
    if (items.length === 0) return 'no line items found'

    const photoNote = await attachProposalPhotos(supa, projectId, html)

    const { data: existing } = await supa
      .from('er_line_items')
      .select('id, name, status')
      .eq('proposal_id', pid)
    const paired = new Set<string>()
    for (const [i, it] of items.entries()) {
      const match = (existing ?? []).find((r) => r.name === it.name && !paired.has(r.id))
      if (match) {
        paired.add(match.id)
        await supa
          .from('er_line_items')
          .update({ description: it.description, quantity: it.quantity, position: i })
          .eq('id', match.id)
      } else {
        await supa
          .from('er_line_items')
          .insert({ ...it, project_id: projectId, proposal_id: pid, position: i })
      }
    }
    for (const r of existing ?? []) {
      if (!paired.has(r.id) && r.status === 'suggested')
        await supa.from('er_line_items').delete().eq('id', r.id)
    }
    await rebuildScope(supa, projectId)
    return `${items.length} line items synced${photoNote ? `; ${photoNote}` : ''}`
  } catch (e) {
    return `portal fetch failed: ${String(e).slice(0, 100)}`
  }
}

/** Photos placed on the client-facing proposal/change-order document are
 *  public S3 images — harvest them into the project's Files as reference
 *  photos for the floor (no prices on images, so staff-visible). */
async function attachProposalPhotos(supa: SupabaseClient, projectId: string, html: string): Promise<string> {
  const urls = [
    ...new Set(
      [...html.matchAll(/https:\/\/s3\.amazonaws\.com\/estimaterocket\/photos\/[^"'\s]+/g)].map((m) => m[0]),
    ),
  ]
  if (urls.length === 0) return ''
  const { data: admin } = await supa.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle()
  if (!admin) return 'no admin user for photo attribution'
  let added = 0
  for (const url of urls) {
    const key = url.match(/photos\/([0-9a-f-]{36})/)?.[1]
    if (!key) continue
    const path = `projects/${projectId}/er-photo-${key}.jpg`
    const { data: seen } = await supa.from('files').select('id').eq('storage_path', path).limit(1)
    if (seen && seen.length > 0) continue
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) })
      if (!res.ok) continue
      const bytes = new Uint8Array(await res.arrayBuffer())
      if (bytes.length < 100) continue
      const contentType = res.headers.get('content-type') ?? 'image/jpeg'
      if (!contentType.startsWith('image/')) continue
      const up = await supa.storage.from('files').upload(path, bytes, { contentType, upsert: true })
      if (up.error) continue
      const { error } = await supa.from('files').insert({
        project_id: projectId,
        uploaded_by: admin.id,
        file_name: `Estimate photo ${key.slice(0, 4)}.jpg`,
        file_type: 'photo',
        storage_path: path,
        file_size_bytes: bytes.length,
      })
      if (!error) added++
    } catch {
      /* best effort — next photo */
    }
  }
  return added > 0 ? `${added} photos attached` : ''
}

/** The spec bullets describe the piece, not a task (owner, 2026-07-27) — the
 *  project's Scope is rebuilt from every non-dismissed line item on ingest. */
async function rebuildScope(supa: SupabaseClient, projectId: string) {
  const { data: items } = await supa
    .from('er_line_items')
    .select('name, description, quantity, status')
    .eq('project_id', projectId)
    .neq('status', 'dismissed')
    .order('position')
  const text = (items ?? [])
    .map((it) => {
      const qty = it.quantity !== null && it.quantity > 1 ? ` ×${it.quantity}` : ''
      return `${it.name}${qty}${it.description ? `\n${it.description}` : ''}`
    })
    .join('\n\n')
  if (!text) return
  await supa.from('projects').update({ description: text }).eq('id', projectId)
  supa.functions.invoke('translate', { body: { table: 'projects', id: projectId } }).catch(() => {})
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
  // Accepted = the project already reads "Work Order", OR this very event is a
  // client approval through the portal (the instant trigger fires at that
  // moment, while the project state is still mid-transition as "Pending").
  const proposalStatus = String((ev.payload as any).status ?? '')
  const clientAccepted =
    proposalStatus === 'Approved' || !!String((ev.payload as any).client_accepted_at ?? '').trim()
  if (p.project_state_type !== 'Work Order' && !clientAccepted)
    return {
      result: 'skipped',
      note: `state "${p.project_state_type}", proposal "${proposalStatus || 'n/a'}" — not an accepted work order`,
    }

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
    const liNote = await enrichFromProposals(supa, existing.id, ev, p, client, wo)
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

  const liNote = await enrichFromProposals(supa, proj.id, ev, p, client, wo)

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

    // Also refresh every imported project from its portal: edits inside an
    // existing proposal fire no webhook, so Re-sync is the manual pull.
    let refreshed = 0
    const { data: imported } = await supa
      .from('projects')
      .select('id, work_order_number, er_portal_url')
      .not('er_portal_url', 'is', null)
    for (const pr of imported ?? []) {
      const m = String(pr.er_portal_url).match(/customerportal\.estimaterocket\.com\/([^/]+)\/([^/]+)\/([^/?]+)/)
      if (!m) continue
      const [, slug, token, number] = m
      const store = Object.entries(PORTAL_SLUGS).find(([, s]) => s === slug)?.[0]
      if (!store) continue
      const ids = await discoverProposalIds(slug, token, number)
      for (const id of ids) {
        await ingestLineItems(supa, pr.id, store, token, id)
        await attachProposalPdf(supa, pr.id, slug, token, id, pr.work_order_number ?? '')
      }
      if (ids.length > 0) refreshed++
    }
    return json({ ok: true, ...counts, refreshed, details })
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
