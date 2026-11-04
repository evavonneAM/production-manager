import type { jsPDF as JsPDF } from 'jspdf'
import {
  BUSINESSES,
  depositAmount,
  estimateCode,
  estimateTotal,
  fabricNoCharge,
  groupTotals,
  roomOrder,
  lineTotal,
  money,
  type EstimateFull,
  type EstimateLine,
} from './estimates'

// Client-facing estimate in the owner's chosen look (2026-10-27): white paper,
// "Gallery" body with the "Catalog" header — serif titles in wide capitals,
// hairline rules, a stone (#efeceb) band for who it's for and where it goes.
// Letter, points. Always English: it goes to the client. jsPDF's built-in
// Times / Helvetica stand in for the mockup's Cormorant / Inter.
const PW = 612
const PH = 792
const M = 54
const CW = PW - 2 * M
const INK: [number, number, number] = [31, 30, 28]
const INK2: [number, number, number] = [95, 91, 84]
const INK3: [number, number, number] = [151, 146, 138]
const RULE: [number, number, number] = [217, 212, 202]
const STONE: [number, number, number] = [239, 236, 235] // #efeceb, owner 2026-10-27

// Columns: Item | Qty | Each | Amount (right edges).
const C_AMT = M + CW
const C_EACH = C_AMT - 82
const C_QTY = C_EACH - 74
const ITEM_W = C_QTY - 46 - M
const BOTTOM = PH - 60

const clean = (s: string) =>
  s
    .replace(/[″”“]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[−–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/×/g, 'x')
    .replace(/[^\S\n]+/g, ' ')

const qtyText = (l: EstimateLine) => {
  const q = String(Math.round(l.quantity * 100) / 100)
  return l.unit && l.unit !== 'ea' ? `${q} ${clean(l.unit)}` : q
}

export type Logo = { dataUrl: string; aspect: number }

/** Loads a bundled logo as a data URL for jsPDF. */
export async function loadLogo(url: string, aspect: number): Promise<Logo> {
  const blob = await (await fetch(url)).blob()
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  return { dataUrl, aspect }
}

export async function downloadEstimatePdf(est: EstimateFull): Promise<void> {
  const b = BUSINESSES[est.store]
  const [{ jsPDF }, logo] = await Promise.all([import('jspdf'), loadLogo(b.logo, b.logoAspect)])
  const doc = buildEstimatePdf(new jsPDF({ unit: 'pt', format: 'letter' }), est, logo)
  const who = est.client?.name || est.title
  doc.save(`${b.name} Estimate ${estimateCode(est)}${who ? ` - ${who}` : ''}.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
}

export function buildEstimatePdf(doc: JsPDF, est: EstimateFull, logo: Logo): JsPDF {
  const b = BUSINESSES[est.store]
  const code = estimateCode(est)
  const date = new Date(est.estimate_date + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const groups = est.groups ?? []
  const caps = (s: string, x: number, y: number, opts: { align?: 'left' | 'right' | 'center'; color?: [number, number, number]; size?: number } = {}) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(opts.size ?? 7)
    doc.setTextColor(...(opts.color ?? INK2))
    doc.text(s.toUpperCase(), x, y, { align: opts.align, charSpace: 1.4 })
  }
  const hair = (y: number, color = RULE, w = 0.5) => {
    doc.setDrawColor(...color)
    doc.setLineWidth(w)
    doc.line(M, y, C_AMT, y)
  }
  const watermark = () => {
    const w = logo.aspect >= 2 ? 400 : 280
    const h = w / logo.aspect
    doc.saveGraphicsState()
    doc.setGState(doc.GState({ opacity: 0.04 }))
    doc.addImage(logo.dataUrl, 'PNG', (PW - w) / 2, (PH - h) / 2, w, h, 'watermark', 'FAST')
    doc.restoreGraphicsState()
  }

  // ── Header (Catalog): logo + name left, "Estimate" right, black rule ──
  watermark()
  let y = 50
  const logoH = logo.aspect >= 2 ? 22 : 40
  doc.addImage(logo.dataUrl, 'PNG', M, y, logoH * logo.aspect, logoH, 'logo', 'FAST')
  const contact = [b.web, b.email, b.phone].filter(Boolean).join('   ·   ')
  if (logo.aspect >= 2) {
    // A wordmark already spells the name: contact line goes under it.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK3)
    doc.text(contact, M, y + logoH + 14, { charSpace: 0.3 })
  } else {
    const nameX = M + logoH * logo.aspect + 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(b.name.toUpperCase(), nameX, y + logoH / 2 - 2, { charSpace: 2.6 })
    doc.setFontSize(7.5)
    doc.setTextColor(...INK3)
    doc.text(contact, nameX, y + logoH / 2 + 10, { charSpace: 0.3 })
  }

  doc.setFont('times', 'normal')
  doc.setFontSize(32)
  doc.setTextColor(...INK)
  doc.text('Estimate', C_AMT, y + 22, { align: 'right', charSpace: 1 })
  caps(`${code}  ·  ${date}`, C_AMT, y + 38, { align: 'right', size: 6.8 })
  y = Math.max(y + logoH + (logo.aspect >= 2 ? 16 : 0), y + 38) + 16
  hair(y, INK, 0.8)

  // ── Stone band: Prepared for / Install at / Rooms ──
  const c = est.client
  const forLines = c
    ? [c.name, c.company, ...(c.address ? c.address.split('\n') : []), c.phone, c.email].filter((s): s is string => !!s?.trim())
    : []
  const siteLines = est.install_same
    ? ['Same as client']
    : [est.install_name, ...(est.install_address ? est.install_address.split('\n') : [])].filter((s): s is string => !!s?.trim())
  const third = groups.length
    ? { title: 'Rooms', lines: groups.map((g) => g.name.trim() || 'Room') }
    : { title: 'Project', lines: est.title.trim() ? [est.title.trim()] : [] }
  const colW = CW / 3
  doc.setFontSize(8.5)
  const wrapped = [forLines, siteLines, third.lines].map((ls) => ls.flatMap((l) => doc.splitTextToSize(clean(l), colW - 16) as string[]))
  const bandH = 34 + Math.max(...wrapped.map((w) => w.length), 1) * 11.5
  doc.setFillColor(...STONE)
  doc.rect(0, y + 0.4, PW, bandH, 'F')
  ;[
    ['Prepared for', wrapped[0]],
    ['Install at', wrapped[1]],
    [third.title, wrapped[2]],
  ].forEach(([title, ls], i) => {
    const x = M + i * colW
    caps(title as string, x, y + 20, { size: 6.5 })
    ;(ls as string[]).forEach((l, j) => {
      doc.setFont('helvetica', j === 0 && i < 2 ? 'bold' : 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...(j === 0 && i < 2 ? INK : INK2))
      doc.text(l, x, y + 34 + j * 11.5)
    })
  })
  y += bandH + 30

  // ── Paging ──
  const newPage = () => {
    doc.addPage()
    watermark()
    y = 48
    caps(`${b.name}  ·  Estimate ${code}${c ? `  ·  ${clean(c.name)}` : ''}`, M, y, { color: INK3, size: 6.5 })
    y += 24
  }
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage()
  }
  const colHeader = () => {
    caps('Item', M, y)
    caps('Qty', C_QTY, y, { align: 'right' })
    caps('Each', C_EACH, y, { align: 'right' })
    caps('Amount', C_AMT, y, { align: 'right' })
    y += 7
    hair(y, INK, 0.6)
  }

  /** One description line: "• Label: value" gets a bold label. Returns lines used. */
  const descLines = (text: string): { bullet: boolean; label: string; rest: string[] }[] => {
    doc.setFontSize(8)
    return text.split('\n').filter((l) => l.trim()).map((raw) => {
      const l = clean(raw.trim())
      const bullet = l.startsWith('•') || l.startsWith('- ')
      const body = bullet ? l.replace(/^[•-]\s*/, '') : l
      const m = body.match(/^([^:]{1,32}):\s+(.*)$/)
      const label = m ? `${m[1]}: ` : ''
      const value = m ? m[2] : body
      const x0 = bullet ? 9 : 0
      doc.setFont('helvetica', 'bold')
      const lw = label ? doc.getTextWidth(label) : 0
      doc.setFont('helvetica', 'normal')
      const first = (doc.splitTextToSize(value, ITEM_W - x0 - lw) as string[])[0] ?? ''
      const remainder = value.slice(first.length).trim()
      const more = remainder ? (doc.splitTextToSize(remainder, ITEM_W - x0) as string[]) : []
      return { bullet, label, rest: [first, ...more] }
    })
  }

  const fabricById = new Map((est.fabrics ?? []).map((f) => [f.id, f]))
  const drawLine = (l: EstimateLine) => {
    const free = l.kind === 'fabric' && fabricNoCharge(l.fabric_id ? fabricById.get(l.fabric_id) : undefined)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    const name = doc.splitTextToSize(clean(l.name || ''), ITEM_W) as string[]
    const desc = l.description?.trim() ? descLines(l.description) : []
    const descRows = desc.reduce((n, d) => n + d.rest.length, 0)
    ensure(14 + name.length * 12 + Math.min(descRows, 6) * 10.5)
    let ty = y + 15
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(name, M, ty)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK2)
    doc.text(qtyText(l), C_QTY, ty, { align: 'right' })
    doc.text(free ? '—' : money(l.unit_price), C_EACH, ty, { align: 'right' })
    doc.setTextColor(...INK)
    doc.text(free ? '—' : money(lineTotal(l)), C_AMT, ty, { align: 'right' })
    ty += (name.length - 1) * 12 + 3
    for (const d of desc) {
      d.rest.forEach((part, i) => {
        if (ty + 10.5 > BOTTOM) {
          newPage()
          colHeader()
          ty = y + 6
        }
        ty += 10.5
        const x0 = M + (d.bullet ? 9 : 0)
        doc.setFontSize(8)
        if (i === 0 && d.bullet) {
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...INK3)
          doc.text('•', M + 1, ty)
        }
        let x = x0
        if (i === 0 && d.label) {
          doc.setFont('helvetica', 'bold')
          doc.setTextColor(...INK)
          doc.text(d.label, x, ty)
          x += doc.getTextWidth(d.label)
        }
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...INK2)
        doc.text(part, x, ty)
      })
    }
    y = ty + 11
    hair(y)
  }

  const drawRoom = (title: string | null, roomLines: EstimateLine[], subtotal: number | null) => {
    ensure(70)
    if (title) {
      doc.setFont('times', 'normal')
      doc.setFontSize(17)
      doc.setTextColor(...INK)
      doc.text(clean(title).toUpperCase(), M, y, { charSpace: 3.2 })
      y += 20
    }
    colHeader()
    for (const l of roomOrder(roomLines)) drawLine(l)
    if (subtotal !== null) {
      ensure(24)
      y += 16
      caps(`${title ?? ''} subtotal`, C_EACH, y, { align: 'right' })
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...INK)
      doc.text(money(subtotal), C_AMT, y, { align: 'right' })
    }
    y += 34
  }

  // ── Rooms (or one list) ──
  const { rooms, loose } = groupTotals(groups, est.lines)
  const ids = new Set(groups.map((g) => g.id))
  const looseLines = est.lines.filter((l) => !l.group_id || !ids.has(l.group_id))
  for (const r of rooms) {
    const rl = est.lines.filter((l) => l.group_id === r.group.id)
    if (rl.length) drawRoom(r.group.name.trim() || 'Room', rl, r.total)
  }
  if (looseLines.length) drawRoom(groups.length ? 'Additional items' : null, looseLines, groups.length ? loose : null)

  // ── Summary, total, deposit ──
  const total = estimateTotal(est.lines)
  const deposit = depositAmount(groups, est.lines, est.deposit_pct)
  const summaryRows: [string, string][] = [
    ...rooms.filter((r) => est.lines.some((l) => l.group_id === r.group.id)).map((r): [string, string] => [
      clean(r.group.name.trim() || 'Room') + (r.group.approved ? '' : '  (not approved)'),
      money(r.total),
    ]),
    ...(groups.length && looseLines.length ? [['Additional items', money(loose)] as [string, string]] : []),
  ]
  const SX = M + CW - 250
  ensure(summaryRows.length * 18 + 90)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  for (const [k, v] of summaryRows) {
    doc.setTextColor(...INK2)
    doc.text(k, SX, y)
    doc.text(v, C_AMT, y, { align: 'right' })
    y += 6
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.5)
    doc.line(SX, y, C_AMT, y)
    y += 12
  }
  y += 8
  caps('Total', SX, y, { color: INK })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(money(total), C_AMT, y + 1, { align: 'right' })
  y += 8
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.8)
  doc.line(SX, y, C_AMT, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK2)
  doc.text(`Estimated deposit, ${Math.round(est.deposit_pct)}% to secure the job`, SX, y)
  doc.setTextColor(...INK)
  doc.text(money(deposit), C_AMT, y, { align: 'right' })
  if (groups.length) {
    y += 13
    doc.setFontSize(7.5)
    doc.setTextColor(...INK3)
    doc.text(`Deposit is ${Math.round(est.deposit_pct)}% of the rooms you approve.`, SX, y)
  }
  y += 36

  // ── Notes and terms ──
  for (const [title, body] of [
    ['Notes', est.notes],
    ['Terms', est.terms],
  ] as const) {
    if (!body?.trim()) continue
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const text = doc.splitTextToSize(clean(body.trim()), CW) as string[]
    ensure(30)
    caps(title, M, y)
    y += 14
    for (const line of text) {
      ensure(12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...INK2)
      doc.text(line, M, y)
      y += 12
    }
    y += 14
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK3)
    doc.text(`Thank you for your business  ·  ${b.web}`, M, PH - 32, { charSpace: 0.4 })
    doc.text(`Page ${p} of ${pages}`, C_AMT, PH - 32, { align: 'right' })
  }
  return doc
}
