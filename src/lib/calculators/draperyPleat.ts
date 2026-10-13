// Drapery pleat layout for a single panel (pairs are figured one panel at a
// time). Same layout as the original drapery-calculator:
//   Lead edge | pleat, space, pleat, space … pleat | Return
// The spaces fill the finished width; the pleats take up what's left of the
// hemmed width after the lead edge, finished width and return.

export const DEFAULT_RETURN = 2.5
export const DEFAULT_LEAD = 4
export const DEFAULT_PLEATS = 7

export type PleatInput = { hemmed: number; finished: number; ret: number; lead: number; pleats: number }

export type PleatLayout = {
  pleats: number
  /** Pleats − 1. */
  spaces: number
  /** Lead edge pin + one per pleat + return pin. */
  pins: number
  spaceWidth: number
  pleatWidth: number
  /** Hemmed width the rounded layout adds up to. */
  total: number
}

/** Workroom rule: sizes round UP to the next ⅛", never down. */
const up8 = (x: number) => Math.ceil(x * 8 - 1e-9) / 8

export function pleatLayout({ hemmed, finished, ret, lead, pleats }: PleatInput): PleatLayout | null {
  if (!(hemmed > 0 && finished > 0 && pleats >= 2)) return null
  const spaces = pleats - 1
  const spaceWidth = up8(finished / spaces)
  const pleatWidth = up8((hemmed - ret - finished - lead) / pleats)
  if (!(pleatWidth > 0)) return null
  return {
    pleats,
    spaces,
    pins: pleats + 2,
    spaceWidth,
    pleatWidth,
    total: lead + ret + spaces * spaceWidth + pleats * pleatWidth,
  }
}

export type Segment = { type: 'lead' | 'pleat' | 'space' | 'return'; width: number; from: number }

/** Left to right, lead edge first, with each piece's start measured from the lead edge. */
export function segments(l: PleatLayout, ret: number, lead: number): Segment[] {
  const out: Segment[] = []
  let x = 0
  const push = (type: Segment['type'], width: number) => {
    out.push({ type, width, from: x })
    x += width
  }
  push('lead', lead)
  for (let i = 0; i < l.spaces; i++) {
    push('pleat', l.pleatWidth)
    push('space', l.spaceWidth)
  }
  push('pleat', l.pleatWidth)
  push('return', ret)
  return out
}
