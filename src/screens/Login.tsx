import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { LanguageSelect } from '../components/LanguageSelect'
import i18n, { type AppLanguage } from '../i18n'

export default function Login() {
  const { t } = useTranslation()
  const { signIn, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) setError(t('login.invalid'))
    // On success, AuthProvider updates the session and the router redirects.
  }

  async function onForgot() {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError(t('login.needEmailForReset'))
      return
    }
    await sendPasswordReset(email.trim())
    setInfo(t('login.forgotSent'))
  }

  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-slate-900 px-6 py-12 text-slate-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-700 text-xl font-bold shadow-lg">
            PM
          </div>
          <h1 className="text-xl font-semibold">{t('common.appName')}</h1>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-slate-300">
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('login.emailPlaceholder')}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-slate-300">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('login.passwordPlaceholder')}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-400">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white transition hover:bg-amber-500 disabled:opacity-60"
          >
            {submitting ? t('login.signingIn') : t('login.signIn')}
          </button>

          <button
            type="button"
            onClick={onForgot}
            className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            {t('login.forgot')}
          </button>
        </form>

        <div className="mt-10">
          <LanguageSelect
            value={i18n.language as AppLanguage}
            onChange={(lang) => void i18n.changeLanguage(lang)}
          />
        </div>
      </div>
    </main>
  )
}
