export type Pt = { x: number; y: number }
export type Tool = 'line' | 'path' | 'area' | 'pan' | 'scale'
export type Units = 'imp' | 'met'
export type Kind = 'line' | 'path' | 'area'
export type Meas = { id: number; kind: Kind; name: string; pts: Pt[] }
export type Scale = {
  perFt: number
  label: string
  how: 'preset' | 'calib'
  line?: Pt[]
  realFt?: number
}

export const MARKS = {
  blue: '#0958d9',
  red: '#cf1322',
  green: '#237804',
  magenta: '#c41d7f',
  black: '#141414',
} as const
export type MarkKey = keyof typeof MARKS
