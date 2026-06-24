import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import i18n, { type AppLanguage } from '../i18n'

export type Profile = {
  id: string
  email: string
  full_name: string
  phone: string | null
  avatar_url: string | null
  department_id: string | null
  role: 'admin' | 'lead' | 'staff'
  language: AppLanguage
  is_active: boolean
}

type Result = { error: string | null }

type AuthContextValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<Result>
  signOut: () => Promise<void>
  setLanguage: (lang: AppLanguage) => Promise<void>
  updateProfile: (
    fields: Partial<Pick<Profile, 'full_name' | 'phone'>>,
  ) => Promise<Result>
  changePassword: (newPassword: string) => Promise<Result>
  sendPasswordReset: (email: string) => Promise<Result>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    if (!supabase) return
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    if (data) {
      const p = data as Profile
      setProfile(p)
      if (p.language && i18n.language !== p.language) {
        void i18n.changeLanguage(p.language)
      }
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    // Existing session (persisted across app restarts)
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        void loadProfile(data.session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })
    // React to sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next) void loadProfile(next.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<Result> => {
    if (!supabase) return { error: 'not_configured' }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? error.message : null }
  }

  const signOut = async () => {
    await supabase?.auth.signOut()
  }

  const setLanguage = async (lang: AppLanguage) => {
    void i18n.changeLanguage(lang)
    setProfile((p) => (p ? { ...p, language: lang } : p))
    if (supabase && session) {
      await supabase.from('users').update({ language: lang }).eq('id', session.user.id)
    }
  }

  const updateProfile = async (
    fields: Partial<Pick<Profile, 'full_name' | 'phone'>>,
  ): Promise<Result> => {
    if (!supabase || !session) return { error: 'not_signed_in' }
    const { error } = await supabase
      .from('users')
      .update(fields)
      .eq('id', session.user.id)
    if (!error) setProfile((p) => (p ? { ...p, ...fields } : p))
    return { error: error ? error.message : null }
  }

  const changePassword = async (newPassword: string): Promise<Result> => {
    if (!supabase) return { error: 'not_configured' }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: error ? error.message : null }
  }

  const sendPasswordReset = async (email: string): Promise<Result> => {
    if (!supabase) return { error: 'not_configured' }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    return { error: error ? error.message : null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signIn,
        signOut,
        setLanguage,
        updateProfile,
        changePassword,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
