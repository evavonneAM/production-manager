import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antTheme } from 'antd'

export type ThemeMode = 'light' | 'dark' | 'auto'

const STORAGE_KEY = 'pm-theme'
const PRIMARY = '#1677ff'

type ThemeCtx = { mode: ThemeMode; resolved: 'light' | 'dark'; setMode: (m: ThemeMode) => void }
const Ctx = createContext<ThemeCtx>({ mode: 'light', resolved: 'light', setMode: () => {} })

function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return 'light'
}

const systemDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

/**
 * Light / dark / auto (follows the device), saved per device. Sets
 * `data-theme` on <html> so the Tailwind screens recolor (see index.css) and
 * switches Ant Design's algorithm to match.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readMode)
  const [sysDark, setSysDark] = useState(systemDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setSysDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const resolved: 'light' | 'dark' = mode === 'auto' ? (sysDark ? 'dark' : 'light') : mode

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#0f172a' : '#ffffff')
  }, [resolved])

  const setMode = (m: ThemeMode) => {
    setModeState(m)
    try {
      localStorage.setItem(STORAGE_KEY, m)
    } catch {
      // Not saved; still applies for this visit.
    }
  }

  return (
    <Ctx.Provider value={{ mode, resolved, setMode }}>
      <ConfigProvider
        theme={{
          algorithm: resolved === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token: { colorPrimary: PRIMARY },
        }}
      >
        {children}
      </ConfigProvider>
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(Ctx)
