import { supabase } from './supabase'
import type { FileRow } from './types'

const BUCKET = 'files'
const MAX_BYTES = 50 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export type UploadScope = {
  projectId: string
  jobId?: string | null
  inspectionId?: string | null
}

function isPdf(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}
function isPhoto(file: File) {
  return PHOTO_TYPES.includes(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
}

/** ~300px JPEG thumbnail rendered in the browser (Sharp can't run on the Deno
 *  edge runtime and server-side transforms need the paid plan). Null on failure
 *  — upload proceeds without a thumb. */
async function makeThumb(file: File, max = 300): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, w, h)
    return await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.8))
  } catch {
    return null
  }
}

/** Upload a photo/PDF to the private bucket + insert its files row. */
export async function uploadFile(params: {
  file: File
  scope: UploadScope
  userId: string
}): Promise<{ error: string | null }> {
  const { file, scope, userId } = params
  if (file.size > MAX_BYTES) return { error: 'too_large' }
  const pdf = isPdf(file)
  if (!pdf && !isPhoto(file)) return { error: 'bad_type' }

  const id = crypto.randomUUID()
  const ext = pdf ? 'pdf' : (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `projects/${scope.projectId}/${id}.${ext}`

  const up = await client()
    .storage.from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined })
  if (up.error) return { error: up.error.message }

  let thumbnailPath: string | null = null
  if (!pdf) {
    const thumb = await makeThumb(file)
    if (thumb) {
      thumbnailPath = `projects/${scope.projectId}/thumbs/${id}.jpg`
      const tu = await client()
        .storage.from(BUCKET)
        .upload(thumbnailPath, thumb, { contentType: 'image/jpeg' })
      if (tu.error) thumbnailPath = null // original still stands
    }
  }

  const { error } = await client().from('files').insert({
    project_id: scope.projectId,
    job_id: scope.jobId ?? null,
    inspection_id: scope.inspectionId ?? null,
    uploaded_by: userId,
    file_name: file.name,
    file_type: pdf ? 'pdf' : 'photo',
    storage_path: path,
    file_size_bytes: file.size,
    thumbnail_path: thumbnailPath,
  })
  if (error) {
    // Roll the orphaned objects back so storage stays tidy.
    await client().storage.from(BUCKET).remove([path, ...(thumbnailPath ? [thumbnailPath] : [])])
    return { error: error.message }
  }
  return { error: null }
}

/** Files for a job (or all of a project's when jobId omitted), newest first. */
export async function listFiles(scope: { projectId: string; jobId?: string }): Promise<FileRow[]> {
  let q = client().from('files').select('*').order('created_at', { ascending: false })
  if (scope.jobId) q = q.eq('job_id', scope.jobId)
  else q = q.eq('project_id', scope.projectId)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as FileRow[]
}

/** Short-lived signed URL (1h per SPEC §13). */
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await client().storage.from(BUCKET).createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

/** Batch signed URLs, keyed by path. */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (paths.length === 0) return map
  const { data } = await client().storage.from(BUCKET).createSignedUrls(paths, 3600)
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) map.set(item.path, item.signedUrl)
  }
  return map
}

/** Remove the storage objects then the row (RLS: owner or admin). */
export async function deleteFile(row: FileRow): Promise<{ error: string | null }> {
  const paths = [row.storage_path, ...(row.thumbnail_path ? [row.thumbnail_path] : [])]
  const rm = await client().storage.from(BUCKET).remove(paths)
  if (rm.error) return { error: rm.error.message }
  const { error } = await client().from('files').delete().eq('id', row.id)
  return { error: error ? error.message : null }
}

/** Profile photo → public avatars bucket → users.avatar_url (cache-busted). */
export async function uploadAvatar(file: File, userId: string): Promise<{ error: string | null; url?: string }> {
  if (!isPhoto(file)) return { error: 'bad_type' }
  const thumb = await makeThumb(file, 256)
  const blob = thumb ?? file
  if (blob.size > 5 * 1024 * 1024) return { error: 'too_large' }
  const path = `${userId}.jpg`
  const up = await client()
    .storage.from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (up.error) return { error: up.error.message }
  const { data } = client().storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?v=${Date.now()}`
  const { error } = await client().from('users').update({ avatar_url: url }).eq('id', userId)
  return { error: error ? error.message : null, url }
}
