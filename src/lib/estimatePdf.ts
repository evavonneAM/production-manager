import type { jsPDF as JsPDF } from 'jspdf'
import { BUSINESSES, estimateCode, estimateTotal, lineTotal, money, type EstimateFull } from './estimates'

// Client-facing estimate. Letter, points. Always English: it goes to the
// client, and jsPDF's built-in font has no Cyrillic.
const PW = 612
const PH = 792
const M = 50
const CW = PW - 2 * M
const INK: [number, number, number] = [21, 26, 33]
const MUTED: [number, number, number] = [62, 71, 84]
const RULE: [number, number, number] = [201, 209, 219]
const NAVY: [number, number, number] = [31, 78, 121]
const TINT: [number, number, number] = [241, 246, 251]

// Columns: item/description | qty | unit price | total
const C_QTY = M + CW - 230
const C_PRICE = M + CW - 95
const C_TOTAL = M + CW
const DESC_W = C_QTY - 40 - M - 8

const clean = (s: string) =>
  s
    .replace(/[″”“]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[−–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/×/g, 'x')
    .replace(/[^\S\n]+/g, ' ')

const qtyText = (n: number) => String(Math.round(n * 100) / 100)

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

  const watermark = () => {
    const w = logo.aspect >= 2 ? 420 : 300
    const h = w / logo.aspect
    doc.saveGraphicsState()
    doc.setGState(doc.GState({ opacity: 0.06 }))
    doc.addImage(logo.dataUrl, 'PNG', (PW - w) / 2, (PH - h) / 2, w, h, 'watermark', 'FAST')
    doc.restoreGraphicsState()
  }

  // ── First-page header: logo left, business contact right ──
  watermark()
  const logoH = logo.aspect >= 2 ? 44 : 70
  const logoW = logoH * logo.aspect
  doc.addImage(logo.dataUrl, 'PNG', M, M - 6, logoW, logoH, 'logo', 'FAST')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(b.name, C_TOTAL, M + 4, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  const contact = [...b.address, b.phone, b.web, b.email].filter(Boolean) as string[]
  contact.forEach((l, i) => doc.text(l, C_TOTAL, M + 18 + i * 12, { align: 'right' }))
  let y = Math.max(M - 6 + logoH, M + 18 + contact.length * 12) + 18

  doc.setDrawColor(...NAVY)
  doc.setLineWidth(3)
  doc.line(M, y, C_TOTAL, y)
  y += 30

  // ── Title + estimate facts ──
  doc.setTextColor(...NAVY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.text('ESTIMATE', M, y)
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  const facts: [string, string][] = [
    ['Estimate #', code],
    ['Date', date],
  ]
  facts.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold')
    doc.text(k, C_TOTAL - 120, y - 12 + i * 14, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.text(v, C_TOTAL, y - 12 + i * 14, { align: 'right' })
  })
  y += 26

  // ── Prepared for / project ──
  const label = (s: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...NAVY)
    doc.text(s.toUpperCase(), x, yy, { charSpace: 0.6 })
  }
  const c = est.client
  const forLines = c
    ? [c.name, c.company, ...(c.address ? c.address.split('\n') : []), c.phone, c.email].filter((s): s is string => !!s?.trim())
    : []
  label('Prepared for', M, y)
  if (est.title.trim()) label('Project', M + CW / 2 + 10, y)
  y += 14
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  forLines.forEach((l, i) => {
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal')
    doc.text(clean(l), M, y + i * 13)
  })
  if (est.title.trim()) {
    doc.setFont('helvetica', 'bold')
    const t = doc.splitTextToSize(clean(est.title), CW / 2 - 10) as string[]
    doc.text(t, M + CW / 2 + 10, y)
  }
  y += Math.max(forLines.length, 1) * 13 + 20

  // ── Line items ──
  const tableHeader = () => {
    doc.setFillColor(...NAVY)
    doc.rect(M, y, CW, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const hy = y + 14
    doc.text('ITEM', M + 8, hy, { charSpace: 0.6 })
    doc.text('QTY', C_QTY, hy, { align: 'right', charSpace: 0.6 })
    doc.text('UNIT PRICE', C_PRICE, hy, { align: 'right', charSpace: 0.6 })
    doc.text('TOTAL', C_TOTAL - 8, hy, { align: 'right', charSpace: 0.6 })
    y += 22
  }
  const newPage = () => {
    doc.addPage()
    watermark()
    y = M
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...MUTED)
    doc.text(`${b.name}  ·  Estimate ${code}${c ? `  ·  ${clean(c.name)}` : ''}`, M, y)
    y += 18
  }
  const ensure = (h: number, withHeader: boolean) => {
    if (y + h > PH - M - 20) {
      newPage()
      if (withHeader) tableHeader()
    }
  }

  tableHeader()
  let section: string | null | undefined
  for (const l of est.lines) {
    const sec = l.section?.trim() || null
    if (sec && sec !== section) {
      ensure(24 + 20, true)
      doc.setFillColor(...TINT)
      doc.rect(M, y, CW, 22, 'F')
      doc.setTextColor(...NAVY)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.text(clean(sec).toUpperCase(), M + 8, y + 15, { charSpace: 0.4 })
      y += 22
    }
    section = sec

    doc.setFontSize(10)
    const name = doc.splitTextToSize(clean(l.name || ''), DESC_W) as string[]
    doc.setFontSize(9)
    const desc = l.description?.trim() ? (doc.splitTextToSize(clean(l.description.trim()), DESC_W) as string[]) : []
    const rowH = 10 + name.length * 13 + (desc.length ? 3 + desc.length * 11.5 : 0) + 6

    // Long descriptions may run over a page: draw them in chunks.
    let di = 0
    let first = true
    while (first || di < desc.length) {
      ensure(Math.min(rowH, 80), true)
      let ty = y + 15
      if (first) {
        doc.setTextColor(...INK)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        doc.text(name, M + 8, ty)
        doc.setFont('helvetica', 'normal')
        doc.text(`${qtyText(l.quantity)}${l.unit ? ` ${clean(l.unit)}` : ''}`, C_QTY, ty, { align: 'right' })
        doc.text(money(l.unit_price), C_PRICE, ty, { align: 'right' })
        doc.setFont('helvetica', 'bold')
        doc.text(money(lineTotal(l)), C_TOTAL - 8, ty, { align: 'right' })
        ty += (name.length - 1) * 13 + 3
      }
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      while (di < desc.length && ty + 11.5 < PH - M - 20) {
        ty += 11.5
        doc.text(desc[di], M + 8, ty)
        di++
      }
      y = ty + 10
      doc.setDrawColor(...RULE)
      doc.setLineWidth(0.5)
      doc.line(M, y, C_TOTAL, y)
      if (di < desc.length) {
        newPage()
        tableHeader()
      }
      first = false
    }
  }

  // ── Total ──
  ensure(40, false)
  y += 8
  doc.setFillColor(...NAVY)
  doc.rect(C_PRICE - 70, y, C_TOTAL - (C_PRICE - 70), 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('TOTAL', C_PRICE - 60, y + 18, { charSpace: 0.6 })
  doc.setFontSize(13)
  doc.text(money(estimateTotal(est.lines)), C_TOTAL - 8, y + 19, { align: 'right' })
  y += 50

  // ── Notes and terms ──
  for (const [title, body] of [
    ['Notes', est.notes],
    ['Terms', est.terms],
  ] as const) {
    if (!body?.trim()) continue
    doc.setFontSize(9.5)
    const text = doc.splitTextToSize(clean(body.trim()), CW) as string[]
    ensure(30, false)
    label(title, M, y)
    y += 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    for (const line of text) {
      ensure(13, false)
      doc.text(line, M, y)
      y += 13
    }
    y += 14
  }

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text([b.name, b.web, b.email].join('  ·  '), M, PH - 28)
    doc.text(`Page ${p} of ${pages}`, C_TOTAL, PH - 28, { align: 'right' })
  }
  return doc
}
