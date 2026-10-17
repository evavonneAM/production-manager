import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { LanguageSelect } from '../components/LanguageSelect'
import i18n, { type AppLanguage } from '../i18n'
import { AppLogo } from '../components/AppLogo'

export default function Login() {
  const { t } = useTranslation()
  const { signIn, signInWithGoogle, sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Google sends people back here with an error when their email isn't on the team.
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(
      window.location.search || window.location.hash.replace(/^#/, ''),
    )
    return params.get('error') ? t('login.googleNotAllowed') : null
  })
  useEffect(() => {
    if (/[?#&]error=/.test(window.location.href)) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [])
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onGoogle() {
    setError(null)
    setInfo(null)
    const { error } = await signInWithGoogle()
    if (error) setError(t('login.googleNotAllowed'))
  }

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
          <AppLogo size={56} radius={16} />
          <h1 className="text-xl font-semibold">{t('common.appName')}</h1>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#d9d9d9] bg-[#ffffff] px-4 py-2.5 font-medium text-[#1f1f1f] transition hover:bg-[#f5f5f5]"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          {t('login.google')}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-500">
          <span className="h-px flex-1 bg-slate-700" />
          {t('login.or')}
          <span className="h-px flex-1 bg-slate-700" />
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
