// Two-way Google Sheets sync for materials (Sprint 9).
// Idempotent full reconcile between the materials table and the shared sheet:
//   sheet-only change -> written to the app;  app-only change -> written to the
//   sheet;  both changed since last sync -> the app wins, conflict noted.
// `synced_snapshot` (jsonb per material) is the last state both sides agreed on.
// The app is authoritative for existence: rows deleted in the app are removed
// from the sheet; brand-new sheet rows (no ID, valid job code) become materials.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://esm.sh/jose@5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Sheet columns A..N. B/C/D are app-derived (informational); E..M sync two-way.
const HEADER = [
  'ID', 'Store', 'Job Code', 'Client', 'Category', 'Material', 'Details',
  'Qty', 'Unit', 'Supplier', 'Payment req', 'Ordered', 'Arrived', 'Last updated',
]
const CATEGORIES = ['fabric', 'com', 'insert', 'other']

type Snap = {
  category: string
  name: string
  description: string | null
  quantity: number
  unit: string | null
  supplier: string | null
  payment_required: boolean
  is_ordered: boolean
  is_arrived: boolean
}

const s = (v: unknown): string | null => {
  const t = String(v ?? '').trim()
  return t === '' ? null : t
}
const b = (v: unknown): boolean => v === true || String(v ?? '').trim().toUpperCase() === 'TRUE'
const n = (v: unknown): number => {
  const x = parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(x) ? x : 0
}
// jsonb does NOT preserve key order, so stored snapshots must be rebuilt into
// the fixed field order (with the same coercions) before a stringify compare.
// deno-lint-ignore no-explicit-any
function normalizeSnap(o: any): Snap {
  return {
    category: String(o?.category ?? 'other'),
    name: String(o?.name ?? ''),
    description: s(o?.description),
    quantity: Number(o?.quantity ?? 0),
    unit: s(o?.unit),
    supplier: s(o?.supplier),
    payment_required: !!o?.payment_required,
    is_ordered: !!o?.is_ordered,
    is_arrived: !!o?.is_arrived,
  }
}
const sameSnap = (x: Snap, y: Snap) => JSON.stringify(x) === JSON.stringify(y)
const stamp = () => new Date().toISOString().slice(0, 16).replace('T', ' ')

function rowToSnap(r: unknown[]): Snap {
  const cat = (s(r[4]) ?? 'other').toLowerCase()
  return {
    category: CATEGORIES.includes(cat) ? cat : 'other',
    name: s(r[5]) ?? '',
    description: s(r[6]),
    quantity: n(r[7]),
    unit: s(r[8]),
    supplier: s(r[9]),
    payment_required: b(r[10]),
    is_ordered: b(r[11]),
    is_arrived: b(r[12]),
  }
}

// deno-lint-ignore no-explicit-any
function dbToSnap(m: any): Snap {
  return {
    category: m.category,
    name: m.name,
    description: s(m.description),
    quantity: Number(m.quantity),
    unit: s(m.unit),
    supplier: s(m.supplier),
    payment_required: !!m.payment_required,
    is_ordered: !!m.is_ordered,
    is_arrived: !!m.is_arrived,
  }
}

// deno-lint-ignore no-explicit-any
function dbToRow(m: any, jobCode: string, clientName: string, note: string): unknown[] {
  const store = (jobCode.match(/^[A-Za-z]+/) ?? [''])[0]
  return [
    m.id, store, jobCode, clientName, m.category, m.name, m.description ?? '',
    Number(m.quantity), m.unit ?? '', m.supplier ?? '',
    m.payment_required === true, m.is_ordered === true, m.is_arrived === true,
    note,
  ]
}

async function googleToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SA_EMAIL')
  const rawKey = Deno.env.get('GOOGLE_SA_KEY')
  if (!email || !rawKey) throw new Error('Google service account secrets not set')
  const key = await jose.importPKCS8(rawKey.replace(/\\n/g, '\n'), 'RS256')
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const sheetId = Deno.env.get('SHEET_ID')
    if (!sheetId) return json({ ok: false, error: 'SHEET_ID not set' }, 500)
    const token = await googleToken()
    const gauth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // --- sheet metadata (first tab) ------------------------------------------
    const metaRes = await fetch(`${base}?fields=sheets(properties(sheetId,title))`, { headers: gauth })
    if (!metaRes.ok) return json({ ok: false, error: `sheet meta: ${await metaRes.text()}` }, 502)
    const meta = await metaRes.json()
    const tab = meta.sheets[0].properties
    const range = (a1: string) => `${base}/values/${encodeURIComponent(`${tab.title}!${a1}`)}`

    // --- read the whole grid --------------------------------------------------
    const gridRes = await fetch(range('A1:N10000'), { headers: gauth })
    if (!gridRes.ok) return json({ ok: false, error: `sheet read: ${await gridRes.text()}` }, 502)
    const grid: unknown[][] = (await gridRes.json()).values ?? []

    const updates: { range: string; values: unknown[][] }[] = []
    const appendRows: unknown[][] = []
    const deleteRowIdx: number[] = [] // 0-based grid indexes
    let pulled = 0, pushed = 0, created = 0, conflicts = 0

    // Header (create/repair + freeze row on first run)
    if (grid.length === 0 || String(grid[0]?.[0] ?? '') !== 'ID') {
      updates.push({ range: `${tab.title}!A1:N1`, values: [HEADER] })
      if (grid.length === 0) {
        await fetch(`${base}:batchUpdate`, {
          method: 'POST', headers: gauth,
          body: JSON.stringify({
            requests: [{
              updateSheetProperties: {
                properties: { sheetId: tab.sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            }],
          }),
        })
      }
    }

    // --- load the app side -----------------------------------------------------
    const { data: mats, error: mErr } = await supa.from('materials').select('*')
    if (mErr) return json({ ok: false, error: mErr.message }, 500)
    const { data: jobs } = await supa.from('jobs').select('id, job_code, project_id')
    const { data: projects } = await supa.from('projects').select('id, client_name')
    const jobById = new Map((jobs ?? []).map((j) => [j.id, j]))
    const jobByCode = new Map((jobs ?? []).map((j) => [j.job_code.toUpperCase(), j]))
    const clientOf = (projectId: string) =>
      (projects ?? []).find((p) => p.id === projectId)?.client_name ?? ''
    const matById = new Map((mats ?? []).map((m) => [m.id, m]))

    const seenIds = new Set<string>()

    // --- walk existing sheet rows ----------------------------------------------
    for (let i = 1; i < grid.length; i++) {
      const row = grid[i]
      if (!row || row.every((c) => String(c ?? '').trim() === '')) continue
      const rowNum = i + 1
      const id = s(row[0])

      // New row typed into the sheet: no ID yet -> create the material.
      if (!id) {
        const code = (s(row[2]) ?? '').toUpperCase()
        const snap = rowToSnap(row)
        // Formatting noise (e.g. checkbox columns reporting FALSE on empty
        // rows) is not a real entry — only react when someone actually typed.
        if (!code && !snap.name) continue
        const job = jobByCode.get(code)
        if (!job || !snap.name) {
          updates.push({ range: `${tab.title}!N${rowNum}`, values: [['unknown job code - not imported']] })
          continue
        }
        const { data: ins, error: insErr } = await supa
          .from('materials')
          .insert({ job_id: job.id, ...snap, sync_source: 'sheet', sheet_row_ref: String(rowNum), synced_snapshot: snap })
          .select('*').single()
        if (insErr || !ins) continue
        created++
        updates.push({ range: `${tab.title}!A${rowNum}:N${rowNum}`, values: [dbToRow(ins, job.job_code, clientOf(job.project_id), `Sheet @ ${stamp()}`)] })
        // fire-and-forget name translation
        void fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/translate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ table: 'materials', id: ins.id }),
        }).catch(() => {})
        continue
      }

      const m = matById.get(id)
      if (!m) {
        // Deleted in the app -> remove the sheet row.
        deleteRowIdx.push(i)
        continue
      }
      seenIds.add(id)

      const job = jobById.get(m.job_id)
      const jobCode = job?.job_code ?? ''
      const clientName = job ? clientOf(job.project_id) : ''
      const sheetSnap = rowToSnap(row)
      const dbSnap = dbToSnap(m)
      const last: Snap = m.synced_snapshot ? normalizeSnap(m.synced_snapshot) : dbSnap
      const sheetChanged = !sameSnap(sheetSnap, last)
      const appChanged = !sameSnap(dbSnap, last)

      if (!sheetChanged && !appChanged) {
        if (m.sheet_row_ref !== String(rowNum)) {
          await supa.from('materials').update({ sheet_row_ref: String(rowNum) }).eq('id', id)
        }
        continue
      }

      if (sheetChanged && !appChanged) {
        // Pull sheet edits into the app.
        const patch: Record<string, unknown> = {
          ...sheetSnap, sync_source: 'sheet', synced_snapshot: sheetSnap, sheet_row_ref: String(rowNum),
        }
        if (sheetSnap.is_ordered && !dbSnap.is_ordered) patch.ordered_at = new Date().toISOString()
        if (sheetSnap.is_arrived && !dbSnap.is_arrived) patch.arrived_at = new Date().toISOString()
        const { error } = await supa.from('materials').update(patch).eq('id', id)
        if (!error) {
          pulled++
          updates.push({ range: `${tab.title}!N${rowNum}`, values: [[`Sheet @ ${stamp()}`]] })
          if (sheetSnap.name !== dbSnap.name) {
            void fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/translate`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ table: 'materials', id }),
            }).catch(() => {})
          }
        }
        continue
      }

      // App changed (alone or both) -> app wins, push to sheet.
      const note = sheetChanged ? `conflict - app kept @ ${stamp()}` : `App @ ${stamp()}`
      if (sheetChanged) conflicts++
      pushed++
      updates.push({ range: `${tab.title}!A${rowNum}:N${rowNum}`, values: [dbToRow(m, jobCode, clientName, note)] })
      await supa.from('materials').update({ synced_snapshot: dbSnap, sheet_row_ref: String(rowNum) }).eq('id', id)
    }

    // --- add app materials missing from the sheet -------------------------------
    // Written at the first empty row via explicit ranges (NOT the append API,
    // which skips past formatted-but-empty rows and buries new rows out of sight).
    const idsInSheet = new Set<string>()
    for (let i = 1; i < grid.length; i++) {
      const id = s(grid[i]?.[0])
      if (id) idsInSheet.add(id)
    }
    let nextRow = Math.max(grid.length, 1) + 1
    for (const m of mats ?? []) {
      if (seenIds.has(m.id) || idsInSheet.has(m.id)) continue
      const job = jobById.get(m.job_id)
      if (!job) continue
      appendRows.push(dbToRow(m, job.job_code, clientOf(job.project_id), `App @ ${stamp()}`))
      updates.push({
        range: `${tab.title}!A${nextRow}:N${nextRow}`,
        values: [dbToRow(m, job.job_code, clientOf(job.project_id), `App @ ${stamp()}`)],
      })
      await supa.from('materials').update({ synced_snapshot: dbToSnap(m), sheet_row_ref: String(nextRow) }).eq('id', m.id)
      nextRow++
    }

    // --- write everything back ---------------------------------------------------
    if (updates.length) {
      const res = await fetch(`${base}/values:batchUpdate`, {
        method: 'POST', headers: gauth,
        body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      })
      if (!res.ok) return json({ ok: false, error: `sheet write: ${await res.text()}` }, 502)
    }
    if (deleteRowIdx.length) {
      // bottom-up so indexes stay valid
      const requests = deleteRowIdx.sort((a, z) => z - a).map((i) => ({
        deleteDimension: { range: { sheetId: tab.sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 } },
      }))
      await fetch(`${base}:batchUpdate`, { method: 'POST', headers: gauth, body: JSON.stringify({ requests }) })
    }

    return json({ ok: true, pulled, pushed, created, appended: appendRows.length, deletedRows: deleteRowIdx.length, conflicts })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
