import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { signedUrl, deleteFile } from '../lib/files'
import type { FileRow } from '../lib/types'

/** Full-screen photo viewer (S10): zoom, prev/next, share/download, delete. */
export function FileViewer({
  photos,
  index,
  onIndexChange,
  onClose,
  onDeleted,
}: {
  photos: FileRow[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const file = photos[index]
  const [url, setUrl] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setUrl(null)
    setScale(1)
    let active = true
    void signedUrl(file.storage_path).then((u) => active && setUrl(u))
    return () => {
      active = false
    }
  }, [file.storage_path])

  const canDelete = profile?.id === file.uploaded_by || profile?.role === 'admin'
  const prev = () => index > 0 && onIndexChange(index - 1)
  const next = () => index < photos.length - 1 && onIndexChange(index + 1)

  async function onShare() {
    if (!url) return
    try {
      if (navigator.share) {
        const blob = await (await fetch(url)).blob()
        const shareFile = new File([blob], file.file_name, { type: blob.type })
        if (navigator.canShare?.({ files: [shareFile] })) {
          await navigator.share({ files: [shareFile] })
          return
        }
      }
    } catch {
      /* fall through to open */
    }
    window.open(url, '_blank', 'noopener')
  }

  async function onDelete() {
    setBusy(true)
    await deleteFile(file)
    setBusy(false)
    setConfirming(false)
    onDeleted()
  }

  const btn = 'rounded-lg bg-black/50 px-3 py-2 text-sm text-white backdrop-blur hover:bg-black/70'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95" onClick={onClose}>
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 p-3" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 truncate text-sm text-slate-300">{file.file_name}</span>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setScale((s) => Math.min(4, s * 1.5))} className={btn} aria-label="+">＋</button>
          <button type="button" onClick={() => setScale((s) => Math.max(1, s / 1.5))} className={btn} aria-label="−">－</button>
          <button type="button" onClick={() => void onShare()} className={btn}>{t('files.share')}</button>
          {canDelete && (
            <button type="button" onClick={() => setConfirming(true)} className={`${btn} text-red-300`}>
              {t('notes.delete')}
            </button>
          )}
          <button type="button" onClick={onClose} className={btn}>✕</button>
        </div>
      </div>

      {/* Image area (scrollable when zoomed; native pinch on touch) */}
      <div
        className="flex-1 overflow-auto"
        style={{ touchAction: 'pinch-zoom' }}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={() => setScale((s) => (s === 1 ? 2 : 1))}
      >
        {url ? (
          <div className="flex min-h-full min-w-full items-center justify-center p-2">
            <img
              src={url}
              alt={file.file_name}
              className="max-h-full max-w-full select-none transition-transform"
              style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
              draggable={false}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-500">{t('common.loading')}</div>
        )}
      </div>

      {/* Prev / next */}
      {photos.length > 1 && (
        <div className="flex items-center justify-between p-3" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={prev} disabled={index === 0} className={`${btn} disabled:opacity-30`}>←</button>
          <span className="text-xs text-slate-500">{index + 1} / {photos.length}</span>
          <button type="button" onClick={next} disabled={index === photos.length - 1} className={`${btn} disabled:opacity-30`}>→</button>
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => { e.stopPropagation(); setConfirming(false) }}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-2 text-lg font-semibold">{t('files.deleteTitle')}</h2>
            <p className="mb-5 text-sm text-slate-400">{t('files.deleteBody')}</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
                {t('common.cancel')}
              </button>
              <button type="button" onClick={() => void onDelete()} disabled={busy} className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60">
                {t('taskEdit.deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
