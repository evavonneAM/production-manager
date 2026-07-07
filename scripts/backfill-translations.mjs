// Backfill translations for existing rows by invoking the `translate` Edge Function.
// Run with:  npm run backfill   (needs DEEPL_API_KEY secret set on the project).
// Idempotent: skips rows that already have translations.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function translate(table, id) {
  const { data, error } = await db.functions.invoke('translate', { body: { table, id } })
  if (error) console.log(`  ✗ ${table} ${id}: ${error.message}`)
  else if (data && data.ok === false) console.log(`  ✗ ${table} ${id}: ${data.error}`)
  return !error && (!data || data.ok !== false)
}

let done = 0

const { data: jobs } = await db.from('jobs').select('id,name,description,name_i18n,description_i18n')
for (const j of jobs ?? []) {
  if (!j.name_i18n || (j.description && !j.description_i18n)) if (await translate('jobs', j.id)) done++
}
const { data: projects } = await db.from('projects').select('id,description,description_i18n')
for (const p of projects ?? []) {
  if (p.description && !p.description_i18n) if (await translate('projects', p.id)) done++
}
const { data: materials } = await db.from('materials').select('id,name_i18n')
for (const m of materials ?? []) if (!m.name_i18n) if (await translate('materials', m.id)) done++

const { data: tasks } = await db.from('tasks').select('id,name_i18n')
for (const t of tasks ?? []) if (!t.name_i18n) if (await translate('tasks', t.id)) done++

const { data: notes } = await db.from('notes').select('id,translation_status')
for (const n of notes ?? []) if (n.translation_status !== 'done') if (await translate('notes', n.id)) done++

console.log(`\n✅ Backfill complete — ${done} rows translated.`)
