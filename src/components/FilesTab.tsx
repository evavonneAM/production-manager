import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { useAsync } from '../hooks/useAsync'
import { getDirectory } from '../lib/data'
import { listFiles, uploadFile, signedUrls } from '../lib/files'
import { formatDate } from '../lib/format'
import { EmptyState, ErrorState } from './ui'
import { FileViewer } from './FileViewer'
import type { FileRow } from '../lib/types'

/** Thumbnail grid + upload for a job's (or project's) files (S05/S05a Files tabs). */
export function FilesTab({ projectId, jobId }: { projectId: string; jobId?: string }) {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [thumbs, setThumbs] = useState<Map<string, string>>(new Map())

  const { data: files, loading } = useAsync(
    () => listFiles({ projectId, jobId }),
    [projectId, jobId, reloadKey],
  )
  const { data: directory } = useAsync(getDirectory, [])
  const nameOf = useMemo(() => {
    const map = new Map((directory ?? []).map((u) => [u.id, u.full_name]))
    return (id: string) => map.get(id) ?? '—'
  }, [directory])

  // Resolve signed URLs for the grid (thumb when present, else the original photo).
  useEffect(() => {
    const paths = (files ?? [])
      .filter((f) => f.file_type === 'photo')
      .map((f) => f.thumbnail_path ?? f.storage_path)
    if (paths.length === 0) {
      setThumbs(new Map())
      return
    }
    let active = true
    void signedUrls(paths).then((m) => active && setThumbs(m))
    return () => {
      active = false
    }
  }, [files])

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0 || !profile) return
    setError(null)
    setUploading(true)
    for (const file of Array.from(list)) {
      const { error } = await uploadFile({ file, scope: { projectId, jobId }, userId: profile.id })
      if (error) {
        setError(t([`files.${error}`, 'common.error']))
        break
      }
    }
    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
    setReloadKey((k) => k + 1)
  }

  const photos = (files ?? []).filter((f) => f.file_type === 'photo')

  return (
    <div className="flex flex-col gap-3">
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
        >
          {uploading ? t('files.uploading') : `+ ${t('files.upload')}`}
        </button>
      </div>

      {error && <ErrorState text={error} />}
      {loading && <p className="text-sm text-slate-500">{t('common.loading')}</p>}
      {!loading && (files?.length ?? 0) === 0 && <EmptyState text={t('jobDetail.noFiles')} />}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        {(files ?? []).map((f) => (
          <FileTile
            key={f.id}
            file={f}
            thumbUrl={f.file_type === 'photo' ? thumbs.get(f.thumbnail_path ?? f.storage_path) : undefined}
            caption={`${nameOf(f.uploaded_by)} · ${formatDate(f.created_at, i18n.language)}`}
            onOpen={() => {
              if (f.file_type === 'photo') setViewerIndex(photos.findIndex((p) => p.id === f.id))
              else void openPdf(f)
            }}
          />
        ))}
      </div>

      {viewerIndex !== null && photos[viewerIndex] && (
        <FileViewer
          photos={photos}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          onDeleted={() => {
            setViewerIndex(null)
            setReloadKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}

async function openPdf(f: FileRow) {
  const { signedUrl } = await import('../lib/files')
  const url = await signedUrl(f.storage_path)
  if (url) window.open(url, '_blank', 'noopener')
}

function FileTile({
  file,
  thumbUrl,
  caption,
  onOpen,
}: {
  file: FileRow
  thumbUrl?: string
  caption: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-square overflow-hidden rounded-lg border border-slate-800 bg-slate-800/40 text-left"
    >
      {file.file_type === 'photo' && thumbUrl ? (
        <img src={thumbUrl} alt={file.file_name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-8 w-8 text-slate-500">
            <path d="M14 3v5h5M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          </svg>
          <span className="w-full truncate text-center text-[10px] text-slate-400">{file.file_name}</span>
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[9px] text-slate-300">
        {caption}
      </span>
    </button>
  )
}
