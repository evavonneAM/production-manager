import { useTranslation } from 'react-i18next'

export function FullScreenLoader() {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-full items-center justify-center bg-slate-900 text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-amber-500"
          role="status"
          aria-label={t('common.loading')}
        />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    </div>
  )
}
