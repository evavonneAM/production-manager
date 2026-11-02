// Translate-on-the-fly Edge Function, for free text printed on the tool PDFs.
// Invoked with { texts, target }; returns { texts, detected } in the same order, where
// `detected` is DeepL's guess at each text's language. Nothing is stored. Signed-in
// users only, so the DeepL key (a Supabase secret) can't be spent by anyone else.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// DeepL language codes.
const TARGET: Record<string, string> = { en: 'EN-US', ru: 'RU', es: 'ES' }
const MAX_TEXTS = 50
const MAX_CHARS = 20000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: user } = await supa.auth.getUser(auth.replace(/^Bearer\s+/i, ''))
    if (!user?.user) return json({ ok: false, error: 'sign in required' }, 401)

    const { texts, target } = await req.json()
    const lang = TARGET[target]
    if (!lang || !Array.isArray(texts) || !texts.every((s) => typeof s === 'string')) {
      return json({ ok: false, error: 'texts (string[]) and target (en|es|ru) required' }, 400)
    }
    if (texts.length > MAX_TEXTS || texts.join('').length > MAX_CHARS) return json({ ok: false, error: 'too much text' }, 413)
    if (!texts.length) return json({ ok: true, texts: [], detected: [] })

    const key = Deno.env.get('DEEPL_API_KEY')
    if (!key) throw new Error('DEEPL_API_KEY not set')
    const endpoint = key.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: texts, target_lang: lang }),
    })
    if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const out = data.translations as { text: string; detected_source_language: string }[]
    return json({ ok: true, texts: out.map((x) => x.text), detected: out.map((x) => x.detected_source_language.toLowerCase()) })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
