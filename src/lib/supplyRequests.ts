import { supabase } from './supabase'
import { signedUrls } from './files'
import { useAsync } from '../hooks/useAsync'

// Supply requests (owner, 2026-10-29): anyone on the team asks for shop stock
// or something for a job; Admin / Procurement move it New → Ordered → Done.

const BUCKET = 'files'
const MAX_PHOTO_BYTES = 20 * 1024 * 1024

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export type SupplyRequestStatus = 'new' | 'ordered' | 'done'

export const REQUEST_STATUS_COLOR: Record<SupplyRequestStatus, string> = {
  new: 'red',
  ordered: 'blue',
  done: 'green',
}

export type SupplyRequest = {
  id: string
  item: string
  quantity: string | null
  link: string | null
  note: string | null
  photo_paths: string[]
  status: SupplyRequestStatus
  requested_by: string
  created_at: string
  job: { id: string; job_code: string; name: string } | null
}

export async function getSupplyRequests(): Promise<SupplyRequest[]> {
  const { data, error } = await client()
    .from('supply_requests')
    .select('id, item, quantity, link, note, photo_paths, status, requested_by, created_at, job:jobs ( id, job_code, name )')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []) as unknown as SupplyRequest[]
}

/** Jobs someone might be asking for, newest first (for the "for a job?" picker). */
export async function getRequestableJobs(): Promise<{ id: string; job_code: string; name: string }[]> {
  const { data, error } = await client()
    .from('jobs')
    .select('id, job_code, name')
    .in('status', ['queued', 'in_production'])
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return data ?? []
}

/** File a request; photos go to the private bucket first. */
export async function createSupplyRequest(fields: {
  item: string
  quantity: string
  jobId: string | null
  link: string
  note: string
  photos: File[]
}): Promise<{ error: string | null }> {
  const id = crypto.randomUUID()
  const paths: string[] = []
  for (const file of fields.photos) {
    if (file.size > MAX_PHOTO_BYTES) return { error: 'too_large' }
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `supply-requests/${id}/${crypto.randomUUID()}.${ext}`
    const up = await client().storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined })
    if (up.error) {
      if (paths.length) await client().storage.from(BUCKET).remove(paths)
      return { error: up.error.message }
    }
    paths.push(path)
  }
  const { error } = await client().from('supply_requests').insert({
    id,
    item: fields.item.trim(),
    quantity: fields.quantity.trim() || null,
    job_id: fields.jobId,
    link: fields.link.trim() || null,
    note: fields.note.trim() || null,
    photo_paths: paths,
  })
  if (error) {
    if (paths.length) await client().storage.from(BUCKET).remove(paths)
    return { error: error.message }
  }
  return { error: null }
}

export async function setSupplyRequestStatus(id: string, status: SupplyRequestStatus, userId: string): Promise<{ error: string | null }> {
  const { error } = await client()
    .from('supply_requests')
    .update({ status, status_by: userId, status_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error ? error.message : null }
}

/** Withdraw a request (own + still new, or admin); its photos go too. */
export async function deleteSupplyRequest(req: SupplyRequest): Promise<{ error: string | null }> {
  const { error } = await client().from('supply_requests').delete().eq('id', req.id)
  if (error) return { error: error.message }
  if (req.photo_paths.length) await client().storage.from(BUCKET).remove(req.photo_paths)
  return { error: null }
}

/** Signed URLs for every photo on the shown requests (private bucket). */
export function useRequestPhotos(requests: SupplyRequest[] | null | undefined) {
  const paths = (requests ?? []).flatMap((r) => r.photo_paths)
  const key = paths.join('|')
  const { data } = useAsync(() => signedUrls(paths), [key])
  return data ?? new Map<string, string>()
}
