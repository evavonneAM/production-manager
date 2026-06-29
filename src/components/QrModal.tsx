import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useTranslation } from 'react-i18next'

export function QrModal({
  value,
  title,
  onClose,
  onPrint,
}: {
  value: string
  title: string
  onClose: () => void
  onPrint?: () => void
}) {
  const { t } = useTranslation()
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    void QRCode.toDataURL(value, { margin: 1, width: 320 }).then(setDataUrl)
  }, [value])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-mono text-xl font-bold text-amber-300">{title}</h2>
        {dataUrl ? (
          <img src={dataUrl} alt={title} className="h-56 w-56 rounded-lg bg-white p-2" />
        ) : (
          <div className="h-56 w-56 animate-pulse rounded-lg bg-slate-800" />
        )}
        <div className="flex w-full gap-3">
          {onPrint && (
            <button
              type="button"
              onClick={onPrint}
              className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500"
            >
              {t('qr.printLabel')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800"
          >
            {t('qr.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
