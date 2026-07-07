// Translate-and-store Edge Function (Sprint 7).
// Invoked with { table, id }. Reads the row via the service role, translates the
// relevant field(s) into en/ru/es with DeepL, and writes the results back. The
// DeepL key lives only here (a Supabase secret) — never in the browser.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// DeepL language codes.
const TARGET: Record<string, string> = { en: 'EN-US', ru: 'RU', es: 'ES' }
const SOURCE: Record<string, string> = { en: 'EN', ru: 'RU', es: 'ES' }
const LANGS = ['en', 'ru', 'es'] as const

async function deepl(text: string, target: string, source?: string): Promise<string> {
  const key = Deno.env.get('DEEPL_API_KEY')
  if (!key) throw new Error('DEEPL_API_KEY not set')
  const endpoint = key.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate'
  const body: Record<string, unknown> = { text: [text], target_lang: target }
  if (source) body.source_lang = source
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.translations[0].text
}

// Which field(s) each table translates, and the jsonb column they write to.
const FIELD_MAP: Record<string, [string, string][]> = {
  jobs: [
    ['name', 'name_i18n'],
    ['description', 'description_i18n'],
  ],
  projects: [['description', 'description_i18n']],
  materials: [['name', 'name_i18n']],
  tasks: [['name', 'name_i18n']],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const { table, id } = await req.json()
    if (!table || !id) return json({ ok: false, error: 'table and id required' }, 400)

    const supa = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Notes: translate original_text into the two other languages; the source
    // language column just mirrors the original. Track translation_status.
    if (table === 'notes') {
      const { data: note, error } = await supa.from('notes').select('*').eq('id', id).single()
      if (error || !note) return json({ ok: false, error: 'note not found' }, 404)
      try {
        const upd: Record<string, unknown> = { translation_status: 'done' }
        for (const l of LANGS) {
          upd[`${l}_text`] =
            l === note.original_language
              ? note.original_text
              : await deepl(note.original_text, TARGET[l], SOURCE[note.original_language])
        }
        await supa.from('notes').update(upd).eq('id', id)
        return json({ ok: true })
      } catch (e) {
        await supa.from('notes').update({ translation_status: 'failed' }).eq('id', id)
        return json({ ok: false, error: String(e) }, 502)
      }
    }

    // Work-description fields: translate into all three (DeepL auto-detects source).
    const fields = FIELD_MAP[table]
    if (!fields) return json({ ok: false, error: 'unsupported table' }, 400)
    const { data: row, error } = await supa.from(table).select('*').eq('id', id).single()
    if (error || !row) return json({ ok: false, error: 'row not found' }, 404)

    const updates: Record<string, unknown> = {}
    for (const [field, col] of fields) {
      const text = row[field]
      if (!text) continue
      const i18n: Record<string, string> = {}
      for (const l of LANGS) i18n[l] = await deepl(text, TARGET[l])
      updates[col] = i18n
    }
    if (Object.keys(updates).length) await supa.from(table).update(updates).eq('id', id)
    return json({ ok: true, translated: Object.keys(updates) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
