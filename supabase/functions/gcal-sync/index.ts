// Google Calendar sync (Sprint 11, owner decisions):
//  PUSH (one-way): every scheduled project becomes/updates an all-day spanning
//    event on the shared calendar (marked with a private property so we never
//    re-import our own events). Cleared dates delete the event.
//  PULL: events whose title/description contain a known job code or work-order
//    number (the team's naming convention, e.g. "AM1234 — delivery") are copied
//    into calendar_events, attached to that job/project.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://esm.sh/jose@5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function googleToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SA_EMAIL')
  const rawKey = Deno.env.get('GOOGLE_SA_KEY')
  if (!email || !rawKey) throw new Error('Google service account secrets not set')
  const key = await jose.importPKCS8(rawKey.replace(/\\n/g, '\n'), 'RS256')
  const jwt = await new jose.SignJWT({ scope: 'https://www.googleapis.com/auth/calendar' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  if (!res.ok) throw new Error(`Google token: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

const addDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const calId = Deno.env.get('GCAL_ID')
    if (!calId) return json({ ok: false, error: 'GCAL_ID not set' }, 500)
    const token = await googleToken()
    const gauth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const base = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}`
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const appUrl = 'https://production-manager-henna.vercel.app'

    let pushed = 0, deleted = 0, pulled = 0, pruned = 0
    let pushError: string | null = null

    // ---------------- PUSH: scheduled projects -> events ----------------------
    const { data: projects, error: pErr } = await supa
      .from('projects')
      .select('id, name, client_name, work_order_number, status, scheduled_start, scheduled_end, gcal_event_id')
    if (pErr) return json({ ok: false, error: pErr.message }, 500)

    for (const p of projects ?? []) {
      const active = p.status !== 'complete' && p.status !== 'delivered'
      if (p.scheduled_start && active) {
        const body = {
          summary: [p.work_order_number, p.client_name, p.name].filter(Boolean).join(' — '),
          description: `Production Manager: ${appUrl}/projects/${p.id}`,
          start: { date: p.scheduled_start },
          // Google all-day "end" is exclusive.
          end: { date: addDays(p.scheduled_end ?? p.scheduled_start, 1) },
          extendedProperties: { private: { pmPush: '1' } },
        }
        if (p.gcal_event_id) {
          const res = await fetch(`${base}/events/${p.gcal_event_id}`, { method: 'PATCH', headers: gauth, body: JSON.stringify(body) })
          if (res.status === 404 || res.status === 410) {
            const created = await fetch(`${base}/events`, { method: 'POST', headers: gauth, body: JSON.stringify(body) })
            if (created.ok) {
              const ev = await created.json()
              await supa.from('projects').update({ gcal_event_id: ev.id }).eq('id', p.id)
            }
          }
          if (res.ok) pushed++
        } else {
          const created = await fetch(`${base}/events`, { method: 'POST', headers: gauth, body: JSON.stringify(body) })
          if (created.ok) {
            const ev = await created.json()
            await supa.from('projects').update({ gcal_event_id: ev.id }).eq('id', p.id)
            pushed++
          } else if (!pushError) {
            pushError = `event create ${created.status}: ${(await created.text()).slice(0, 200)}`
          }
        }
      } else if (p.gcal_event_id && !p.scheduled_start) {
        // Dates cleared -> remove the event.
        await fetch(`${base}/events/${p.gcal_event_id}`, { method: 'DELETE', headers: gauth })
        await supa.from('projects').update({ gcal_event_id: null }).eq('id', p.id)
        deleted++
      }
    }

    // ---------------- PULL: code-tagged events -> calendar_events -------------
    const { data: jobs } = await supa.from('jobs').select('id, job_code, project_id')
    const jobMatchers = (jobs ?? [])
      .map((j) => ({ code: j.job_code.toUpperCase(), job_id: j.id, project_id: j.project_id }))
      .sort((a, b) => b.code.length - a.code.length) // job codes before their WO prefixes
    const woMatchers = (projects ?? [])
      .filter((p) => p.work_order_number)
      .map((p) => ({ code: (p.work_order_number as string).toUpperCase(), project_id: p.id }))
      .sort((a, b) => b.code.length - a.code.length)

    const timeMin = new Date(Date.now() - 90 * 86400e3).toISOString()
    const timeMax = new Date(Date.now() + 180 * 86400e3).toISOString()
    const seen = new Set<string>()
    let pageToken = ''
    do {
      const url = `${base}/events?singleEvents=true&maxResults=2500&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}${pageToken ? `&pageToken=${pageToken}` : ''}`
      const res = await fetch(url, { headers: gauth })
      if (!res.ok) return json({ ok: false, error: `gcal list: ${await res.text()}` }, 502)
      const page = await res.json()
      for (const ev of page.items ?? []) {
        if (ev.status === 'cancelled') continue
        if (ev.extendedProperties?.private?.pmPush === '1') continue // our own push
        const text = `${ev.summary ?? ''} ${ev.description ?? ''}`.toUpperCase()
        const jobHit = jobMatchers.find((m) => text.includes(m.code))
        const woHit = jobHit ? null : woMatchers.find((m) => text.includes(m.code))
        if (!jobHit && !woHit) continue
        seen.add(ev.id)
        const allDay = !!ev.start?.date
        const startsAt = ev.start?.dateTime ?? (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null)
        if (!startsAt) continue
        const endsAt = ev.end?.dateTime ?? (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null)
        const row = {
          gcal_event_id: ev.id,
          title: ev.summary ?? '(untitled)',
          starts_at: startsAt,
          ends_at: endsAt,
          all_day: allDay,
          location: ev.location ?? null,
          job_id: jobHit?.job_id ?? null,
          project_id: jobHit?.project_id ?? woHit?.project_id ?? null,
        }
        const { error } = await supa.from('calendar_events').upsert(row, { onConflict: 'gcal_event_id' })
        if (!error) pulled++
      }
      pageToken = page.nextPageToken ?? ''
    } while (pageToken)

    // Prune rows whose event disappeared (within the same window).
    const { data: existing } = await supa
      .from('calendar_events')
      .select('id, gcal_event_id, starts_at')
      .gte('starts_at', timeMin)
      .lte('starts_at', timeMax)
    for (const row of existing ?? []) {
      if (!seen.has(row.gcal_event_id)) {
        await supa.from('calendar_events').delete().eq('id', row.id)
        pruned++
      }
    }

    return json({ ok: true, pushed, deleted, pulled, pruned, ...(pushError ? { pushError } : {}) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
