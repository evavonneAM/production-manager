// Estimate Rocket calendars -> er_appointments (read-only copy).
//  Each ER account's "Subscribe to Calendar" link (an iCal feed) is stored as a
//  secret: ER_ICS_AM, ER_ICS_HOV, ER_ICS_RHU. A business with no link set is
//  skipped. Appointments are upserted by (business, uid); ones that disappear
//  from a feed are removed. Titles carrying a work-order number are linked to
//  that project.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUSINESSES = ['AM', 'HOV', 'RHU'] as const

type Prop = { params: Record<string, string>; value: string }
type VEvent = Record<string, Prop>

/** Unfold lines and pull out each VEVENT's properties (first occurrence wins). */
function parseIcs(text: string): { events: VEvent[]; calTz: string | null } {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/)
  const events: VEvent[] = []
  let calTz: string | null = null
  let cur: VEvent | null = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue }
    const colon = line.indexOf(':')
    if (colon < 0) continue
    const [name, ...paramParts] = line.slice(0, colon).split(';')
    const value = line.slice(colon + 1)
    if (!cur) {
      if (name === 'X-WR-TIMEZONE') calTz = value.trim()
      continue
    }
    const params: Record<string, string> = {}
    for (const p of paramParts) {
      const eq = p.indexOf('=')
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '')
    }
    const key = name.toUpperCase()
    if (!cur[key]) cur[key] = { params, value }
  }
  return { events, calTz }
}

const unescape = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim()

/** Offset (ms) of a named time zone at a given UTC instant. */
function tzOffset(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const n = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - utcMs
}

/** iCal date/date-time -> ISO instant. All-day dates are kept as UTC midnight. */
function toIso(prop: Prop | undefined, fallbackTz: string): { iso: string; allDay: boolean } | null {
  if (!prop) return null
  const v = prop.value.trim()
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, z] = m
  if (h === undefined || prop.params.VALUE === 'DATE') {
    return { iso: `${y}-${mo}-${d}T00:00:00Z`, allDay: true }
  }
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))
  if (z) return { iso: new Date(wall).toISOString(), allDay: false }
  const tz = prop.params.TZID ?? fallbackTz
  let utc = wall
  try {
    // Two passes settle the offset across DST changes.
    utc = wall - tzOffset(tz, wall)
    utc = wall - tzOffset(tz, utc)
  } catch { /* unknown zone: treat as UTC */ }
  return { iso: new Date(utc).toISOString(), allDay: false }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const defaultTz = Deno.env.get('ER_TZ') ?? 'America/New_York'

    const { data: projects } = await supa.from('projects').select('id, work_order_number')
    const woMatchers = (projects ?? [])
      .filter((p) => p.work_order_number)
      .map((p) => ({ code: (p.work_order_number as string).toUpperCase(), project_id: p.id as string }))
      .sort((a, b) => b.code.length - a.code.length)

    const result: Record<string, unknown> = {}
    for (const business of BUSINESSES) {
      const url = Deno.env.get(`ER_ICS_${business}`)
      if (!url) { result[business] = 'no link set'; continue }
      // Calendar apps hand these out as webcal://; fetch needs https://.
      const res = await fetch(url.replace(/^webcal:\/\//i, 'https://'))
      if (!res.ok) { result[business] = `feed ${res.status}`; continue }
      const body = await res.text()
      // A sign-in or error page instead of a calendar would otherwise wipe the copy.
      if (!body.includes('BEGIN:VCALENDAR')) { result[business] = 'not a calendar feed'; continue }
      const { events, calTz } = parseIcs(body)
      const tz = calTz ?? defaultTz

      const rows = []
      for (const ev of events) {
        if (ev.STATUS?.value.toUpperCase() === 'CANCELLED') continue
        const uid = ev.UID?.value.trim()
        const start = toIso(ev.DTSTART, tz)
        if (!uid || !start) continue
        const end = toIso(ev.DTEND, tz)
        const title = unescape(ev.SUMMARY?.value ?? '') || '(untitled)'
        const description = ev.DESCRIPTION ? unescape(ev.DESCRIPTION.value) : null
        const text = `${title} ${description ?? ''}`.toUpperCase()
        rows.push({
          business,
          uid,
          title,
          starts_at: start.iso,
          ends_at: end?.iso ?? null,
          all_day: start.allDay,
          location: ev.LOCATION ? unescape(ev.LOCATION.value) || null : null,
          description,
          project_id: woMatchers.find((m) => text.includes(m.code))?.project_id ?? null,
        })
      }

      let saved = 0
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supa.from('er_appointments').upsert(rows.slice(i, i + 500), { onConflict: 'business,uid' })
        if (error) { result[business] = `save: ${error.message}`; break }
        saved += Math.min(500, rows.length - i)
      }

      // Remove appointments that are no longer in this business's feed.
      const keep = new Set(rows.map((r) => r.uid))
      const { data: existing } = await supa.from('er_appointments').select('id, uid').eq('business', business)
      const gone = (existing ?? []).filter((r) => !keep.has(r.uid)).map((r) => r.id)
      for (let i = 0; i < gone.length; i += 200) {
        await supa.from('er_appointments').delete().in('id', gone.slice(i, i + 200))
      }
      if (result[business] === undefined) result[business] = { saved, removed: gone.length }
    }

    return json({ ok: true, ...result })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
