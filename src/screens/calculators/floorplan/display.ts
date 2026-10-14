import { useCallback, useEffect, useState } from 'react'
import { MARKS, type MarkKey } from './engine/types'

export type Disp = {
  size: number
  lh: number
  font: 'default' | 'inter' | 'atkinson'
  contrast: 'normal' | 'high'
  theme: 'auto' | 'light' | 'dark'
  mark: MarkKey
}

const KEY = 'pm-calc-floorplan-display'
const DEFAULTS: Disp = { size: 16, lh: 1.6, font: 'default', contrast: 'normal', theme: 'light', mark: 'blue' }

export const FONT_STACKS: Record<Disp['font'], string> = {
  default: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  inter: `Inter, -apple-system, 'Helvetica Neue', Arial, sans-serif`,
  atkinson: `'Atkinson Hyperlegible', -apple-system, 'Helvetica Neue', Arial, sans-serif`,
}

function read(): Disp {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null') as Partial<Disp> & { font?: string; mark?: string }
    if (!s) return DEFAULTS
    return {
      size: typeof s.size === 'number' ? s.size : DEFAULTS.size,
      lh: typeof s.lh === 'number' ? s.lh : DEFAULTS.lh,
      font: s.font === 'inter' || s.font === 'atkinson' ? s.font : 'default',
      contrast: s.contrast === 'high' ? 'high' : 'normal',
      theme: s.theme === 'auto' || s.theme === 'dark' ? s.theme : 'light',
      mark: s.mark && s.mark in MARKS ? (s.mark as MarkKey) : 'blue',
    }
  } catch {
    return DEFAULTS
  }
}

/** Display choices (text size, contrast, theme...), saved on this device. */
export function useDisplay() {
  const [disp, setDisp] = useState<Disp>(read)
  const update = useCallback((patch: Partial<Disp>) => {
    setDisp((d) => {
      const next = { ...d, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // Not saved; still applies for this visit.
      }
      return next
    })
  }, [])
  return [disp, update] as const
}

export function useSystemDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}
