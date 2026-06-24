import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import { LanguageSelect } from '../components/LanguageSelect'

export default function Profile() {
  const { t } = useTranslation()
  const { profile, updateProfile, setLanguage, changePassword, signOut } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  if (!profile) return null

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    setProfileMsg(null)
    setSavingProfile(true)
    const { error } = await updateProfile({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
    })
    setSavingProfile(false)
    setProfileMsg(error ? t('common.error') : t('profile.profileSaved'))
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setPwMsg(null)
    setPwError(null)
    if (newPassword.length < 8) {
      setPwError(t('profile.passwordTooShort'))
      return
    }
    setSavingPw(true)
    const { error } = await changePassword(newPassword)
    setSavingPw(false)
    if (error) {
      setPwError(t('common.error'))
    } else {
      setNewPassword('')
      setPwMsg(t('profile.passwordUpdated'))
    }
  }

  return (
    <main className="min-h-full bg-slate-900 text-slate-100">
      <div className="mx-auto w-full max-w-md px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>
          <button
            type="button"
            onClick={() => void signOut()}
            className="text-sm text-slate-400 hover:text-slate-200"
          >
            {t('common.signOut')}
          </button>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{profile.full_name}</h1>
            <p className="truncate text-sm text-slate-400">{profile.email}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t(`roles.${profile.role}`)}</p>
          </div>
        </div>

        {/* Profile details */}
        <form onSubmit={onSaveProfile} className="flex flex-col gap-4">
          <div>
            <label htmlFor="fullName" className="mb-1 block text-sm text-slate-300">
              {t('profile.name')}
            </label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="phone" className="mb-1 block text-sm text-slate-300">
              {t('profile.phone')}
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="language" className="mb-1 block text-sm text-slate-300">
              {t('profile.language')}
            </label>
            <LanguageSelect
              id="language"
              value={profile.language}
              onChange={(lang) => void setLanguage(lang)}
            />
          </div>

          {profileMsg && (
            <p className="text-sm text-green-400">{profileMsg}</p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="rounded-lg bg-amber-600 px-4 py-2.5 font-medium text-white hover:bg-amber-500 disabled:opacity-60"
          >
            {savingProfile ? t('common.saving') : t('common.save')}
          </button>
        </form>

        {/* Change password */}
        <form onSubmit={onChangePassword} className="mt-10 flex flex-col gap-4 border-t border-slate-800 pt-8">
          <h2 className="text-sm font-medium text-slate-300">
            {t('profile.changePassword')}
          </h2>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm text-slate-300">
              {t('profile.newPassword')}
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 focus:border-amber-500 focus:outline-none"
            />
          </div>

          {pwError && <p className="text-sm text-red-400">{pwError}</p>}
          {pwMsg && <p className="text-sm text-green-400">{pwMsg}</p>}

          <button
            type="submit"
            disabled={savingPw || newPassword.length === 0}
            className="rounded-lg border border-slate-600 px-4 py-2.5 font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            {savingPw ? t('common.saving') : t('profile.updatePassword')}
          </button>
        </form>
      </div>
    </main>
  )
}
