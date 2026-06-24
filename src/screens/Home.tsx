import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'

export default function Home() {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const name = profile?.full_name ?? ''

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-slate-900 px-6 py-12 text-slate-100">
      <Avatar name={name} url={profile?.avatar_url} size={64} />

      <div className="text-center">
        <h1 className="text-xl font-semibold">{t('home.welcome', { name })}</h1>
        <p className="mt-2 max-w-xs text-sm text-slate-400">
          {t('home.placeholder')}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3">
        <Link
          to="/profile"
          className="rounded-lg bg-slate-800 px-5 py-2.5 text-center font-medium text-slate-100 hover:bg-slate-700"
        >
          {t('home.profile')}
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-400 hover:bg-slate-800"
        >
          {t('common.signOut')}
        </button>
      </div>
    </main>
  )
}
