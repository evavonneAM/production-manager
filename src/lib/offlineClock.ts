import { supabase } from './supabase'

/** Offline clock-out queue (Sprint 14, BUILD_PLAN): a clock-out tapped with no
 *  signal is stored locally with its tap time and replayed on reconnect, so
 *  the recorded labor ends at the tap, not at whenever wifi came back. Only
 *  one entry is ever needed — a user has at most one open session. */

const KEY = 'pm-pending-clockout'

const isNetworkError = (message: string) =>
  /fetch|network|load failed|connection/i.test(message)

export function pendingClockOut(): { at: string } | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as { at: string }) : null
  } catch {
    return null
  }
}

/** Clock out now; if the network is down, queue it. */
export async function clockOutResilient(): Promise<{ error: string | null; queued: boolean }> {
  if (!supabase) return { error: 'not configured', queued: false }
  const at = new Date().toISOString()
  if (!navigator.onLine) {
    localStorage.setItem(KEY, JSON.stringify({ at }))
    return { error: null, queued: true }
  }
  const { error } = await supabase.rpc('clock_out', { p_at: at })
  if (error && isNetworkError(error.message)) {
    localStorage.setItem(KEY, JSON.stringify({ at }))
    return { error: null, queued: true }
  }
  return { error: error ? error.message : null, queued: false }
}

/** Replay a queued clock-out (app start, reconnect, and before clock-in). */
export async function replayPendingClockOut(): Promise<void> {
  const pending = pendingClockOut()
  if (!pending || !supabase || !navigator.onLine) return
  const { error } = await supabase.rpc('clock_out', { p_at: pending.at })
  // Success — or any *business* error (e.g. not_clocked_in after an auto-close)
  // — retires the entry; only network failures keep it queued.
  if (!error || !isNetworkError(error.message)) localStorage.removeItem(KEY)
}
