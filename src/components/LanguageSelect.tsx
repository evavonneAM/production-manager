import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, type AppLanguage } from '../i18n'

export function LanguageSelect({
  value,
  onChange,
  id,
}: {
  value: AppLanguage
  onChange: (lang: AppLanguage) => void
  id?: string
}) {
  const { t } = useTranslation()
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as AppLanguage)}
      className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 focus:border-amber-500 focus:outline-none"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {t(`languages.${lang}`)}
        </option>
      ))}
    </select>
  )
}
