import { useTranslation } from 'react-i18next'

export default function Placeholder({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-200">{t(titleKey)}</h1>
      <p className="mt-2 max-w-xs text-sm text-slate-500">{t('placeholder.comingSoon')}</p>
    </div>
  )
}
