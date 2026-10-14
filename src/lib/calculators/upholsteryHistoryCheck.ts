// History check: what similar past pieces were priced at in Estimate Rocket.
// Pure functions so the screen stays simple and this can be tested on its own.
import type { HistoryRow } from './upholsteryHistory'

export type PastJob = { price: number; width: number; date: string; account: HistoryRow[5]; ref: string; name: string }

export type HistoryCheck = {
  n: number
  median: number
  low: number
  high: number
  /** Matches were narrowed to pieces within WIDTH_WINDOW inches of this width. */
  sizeMatched: boolean
  /** Only the last two years were used. */
  recentOnly: boolean
  /** Too few slipcover jobs, so reupholstery prices are shown instead. */
  usedUpholstery: boolean
  /** Closest past pieces, for checking by hand. */
  examples: PastJob[]
}

export const WIDTH_WINDOW = 10
/** How far from the past median the estimate can be before it is flagged. */
export const FLAG_PCT = 0.2
const MIN = 5

const ER_HOST: Record<HistoryRow[5], string> = { am: 'alexandermatthews', hov: 'houseofvonne', rh: 'rhupholstery' }
export const ACCOUNT_NAME: Record<HistoryRow[5], string> = { am: 'Alexander Matthews', hov: 'House of Vonne', rh: 'Raleigh Hills' }
export const erLink = (j: PastJob) => `https://${ER_HOST[j.account]}.estimaterocket.com/projects/${j.ref}`

function quantile(sorted: number[], q: number): number {
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo))
}

export function historyCheck(rows: HistoryRow[], typeId: string, service: 'up' | 'slip', width: number, today = new Date()): HistoryCheck | null {
  let usedUpholstery = false
  let pool = rows.filter((r) => r[0] === typeId && r[1] === service)
  if (service === 'slip' && pool.length < MIN) {
    pool = rows.filter((r) => r[0] === typeId && r[1] === 'up')
    usedUpholstery = true
  }
  if (pool.length === 0) return null

  const cutoff = `${today.getFullYear() - 2}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const recent = pool.filter((r) => r[4] >= cutoff)
  const recentOnly = recent.length >= MIN
  if (recentOnly) pool = recent

  let sizeMatched = false
  if (width > 0) {
    const near = pool.filter((r) => r[3] > 0 && Math.abs(r[3] - width) <= WIDTH_WINDOW)
    if (near.length >= MIN) {
      pool = near
      sizeMatched = true
    }
  }

  const prices = pool.map((r) => r[2]).sort((a, b) => a - b)
  const examples = [...pool]
    .sort((a, b) => {
      if (width > 0) {
        const da = a[3] > 0 ? Math.abs(a[3] - width) : 999
        const db = b[3] > 0 ? Math.abs(b[3] - width) : 999
        if (da !== db) return da - db
      }
      return b[4].localeCompare(a[4])
    })
    .slice(0, 6)
    .map((r) => ({ price: r[2], width: r[3], date: r[4], account: r[5], ref: r[6], name: r[7] }))

  return {
    n: prices.length,
    median: quantile(prices, 0.5),
    low: quantile(prices, 0.2),
    high: quantile(prices, 0.8),
    sizeMatched,
    recentOnly,
    usedUpholstery,
    examples,
  }
}

/** How far the estimate is from the past median, as a fraction (+0.25 = 25% higher). */
export const gapFrom = (value: number, median: number) => (median > 0 ? value / median - 1 : 0)
