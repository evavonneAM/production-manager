import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Read from environment variables — never hardcode keys (CLAUDE.md rule 5).
// In Vite, only vars prefixed with VITE_ are exposed to the browser. The anon
// key is safe to ship to the client; Row-Level Security is the real boundary.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True once both env vars are present (i.e. the project is wired to Supabase). */
export const isSupabaseConfigured = Boolean(url && anonKey)

/**
 * The Supabase client, typed against the generated database schema, or `null`
 * until the env vars are set. Keeping it nullable lets the app boot and render
 * before the keys exist (Sprint 0 step 4).
 */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(url as string, anonKey as string)
  : null
