import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/AuthProvider'
import { Avatar } from '../components/Avatar'
import { LanguageSelect } from '../components/LanguageSelect'
import { uploadAvatar } from '../lib/files'
import { Alert, Button, Card, Input, Segmented, Typography, theme } from 'antd'
import { CameraOutlined, LogoutOutlined } from '@ant-design/icons'
import { useTheme, type ThemeMode } from '../lib/theme'

export default function Profile() {
  const { t } = useTranslation()
  const { profile, updateProfile, setLanguage, changePassword, signOut, refreshProfile } = useAuth()
  const { mode: themeMode, setMode: setThemeMode } = useTheme()
  const { token } = theme.useToken()
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarErr, setAvatarErr] = useState<string | null>(null)

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)

  if (!profile) return null

  async function onAvatarPick(list: FileList | null) {
    const file = list?.[0]
    if (!file || !profile) return
    setAvatarErr(null)
    setAvatarBusy(true)
    const { error } = await uploadAvatar(file, profile.id)
    await refreshProfile()
    setAvatarBusy(false)
    if (error) setAvatarErr(t([`files.${error}`, 'common.error']))
  }

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

  const label = (text: string, htmlFor?: string) => (
    <label htmlFor={htmlFor} style={{ display: 'block', marginBottom: 4, fontSize: 13, color: token.colorTextSecondary }}>
      {text}
    </label>
  )

  return (
    <div style={{ maxWidth: 480, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('profile.title')}
        </Typography.Title>
        <Button type="text" icon={<LogoutOutlined />} onClick={() => void signOut()}>
          {t('common.signOut')}
        </Button>
      </div>

      <Card styles={{ body: { padding: 16 } }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <label style={{ position: 'relative', cursor: 'pointer' }} title={t('profile.changePhoto')}>
            <input type="file" accept="image/*" hidden onChange={(e) => void onAvatarPick(e.target.files)} />
            <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
            <span
              style={{
                position: 'absolute',
                right: -4,
                bottom: -4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                fontSize: 12,
                borderRadius: '50%',
                color: '#fff',
                background: token.colorPrimary,
                border: `2px solid ${token.colorBgContainer}`,
              }}
            >
              {avatarBusy ? '…' : <CameraOutlined />}
            </span>
          </label>
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis style={{ display: 'block', fontSize: 16 }}>
              {profile.full_name}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ display: 'block' }}>
              {profile.email}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t(`roles.${profile.role}`)}
            </Typography.Text>
            {avatarErr && (
              <Typography.Text type="danger" style={{ display: 'block', fontSize: 12 }}>
                {avatarErr}
              </Typography.Text>
            )}
          </div>
        </div>
      </Card>

      {/* Profile details */}
      <Card style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
        <form onSubmit={onSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            {label(t('profile.name'), 'fullName')}
            <Input id="fullName" size="large" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            {label(t('profile.phone'), 'phone')}
            <Input
              id="phone"
              size="large"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('profile.phonePlaceholder')}
            />
          </div>
          <div>
            {label(t('profile.language'), 'language')}
            <LanguageSelect id="language" value={profile.language} onChange={(lang) => void setLanguage(lang)} />
          </div>
          <div>
            <span id="appearance-label">{label(t('profile.appearance'))}</span>
            <Segmented
              aria-labelledby="appearance-label"
              block
              size="large"
              value={themeMode}
              onChange={(v) => setThemeMode(v as ThemeMode)}
              options={[
                { value: 'light', label: t('profile.themeLight') },
                { value: 'dark', label: t('profile.themeDark') },
                { value: 'auto', label: t('profile.themeAuto') },
              ]}
            />
            <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
              {t('profile.appearanceHelp')}
            </Typography.Text>
          </div>

          {profileMsg && <Alert type={profileMsg === t('common.error') ? 'error' : 'success'} showIcon title={profileMsg} />}

          <Button type="primary" size="large" htmlType="submit" loading={savingProfile} block>
            {t('common.save')}
          </Button>
        </form>
      </Card>

      {/* Change password */}
      <Card style={{ marginTop: 16 }} styles={{ body: { padding: 16 } }}>
        <form onSubmit={onChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Typography.Text strong>{t('profile.changePassword')}</Typography.Text>
          <div>
            {label(t('profile.newPassword'), 'newPassword')}
            <Input.Password
              id="newPassword"
              size="large"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          {pwError && <Alert type="error" showIcon title={pwError} />}
          {pwMsg && <Alert type="success" showIcon title={pwMsg} />}

          <Button size="large" htmlType="submit" loading={savingPw} disabled={newPassword.length === 0} block>
            {t('profile.updatePassword')}
          </Button>
        </form>
      </Card>
    </div>
  )
}
