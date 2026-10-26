import type { jsPDF as JsPDF } from 'jspdf'
import { formatInches as f } from './inches'
import { mirrored, segments, type DrawDirection, type PleatLayout, type Segment } from './draperyPleat'
import { pdfFont, pdfLanguage, type PdfT } from '../pdfText'

export type PleatWorkOrder = {
  name: string
  job: string
  hemmed: number
  finished: number
  ret: number
  lead: number
  draw: DrawDirection
  layout: PleatLayout
}

/** The PDF's language and font. */
export type PleatPdfOptions = { t: PdfT; lng: string; font: string }

const drawText = (t: PdfT, d: DrawDirection) =>
  d === 'right' ? t('pdf.pleat.drawRight') : d === 'left' ? t('pdf.pleat.drawLeft') : t('pdf.pleat.drawBoth')

// Letter, points.
const PW = 612
const PH = 792
const M = 40
const CW = PW - 2 * M
const INK: [number, number, number] = [20, 24, 31]
const MUTED: [number, number, number] = [96, 104, 116]
const RULE: [number, number, number] = [210, 214, 220]
const HEADER: [number, number, number] = [0, 21, 41]
const FILL = {
  lead: [221, 234, 250],
  return: [221, 234, 250],
  pleat: [255, 244, 204],
  space: [226, 243, 226],
} as const
const PIN: [number, number, number] = [22, 119, 255]

const clean = (s: string) => s.replace(/[″”“]/g, '"').replace(/[−–—]/g, '-').replace(/×/g, 'x')

export async function downloadPleatWorkOrder(w: PleatWorkOrder): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const font = await pdfFont(doc)
  const { t, lng } = pdfLanguage()
  const base = [w.job, w.name].filter(Boolean).join(' - ') || t('pdf.pleat.defaultName')
  buildPleatWorkOrder(doc, w, { t, lng, font }).save(`${t('pdf.pleat.fileName', { base })}.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
}

export function buildPleatWorkOrder(doc: JsPDF, w: PleatWorkOrder, { t, lng, font }: PleatPdfOptions): JsPDF {
  const l = w.layout
  // Header.
  doc.setFillColor(...HEADER)
  doc.rect(0, 0, PW, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(font, 'bold')
  doc.setFontSize(18)
  doc.text(t('pdf.pleat.title'), M, 32)
  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.text(clean([w.job, w.name].filter(Boolean).join('   |   ') || t('pdf.pleat.singlePanel')), M, 50)
  doc.text(new Date().toLocaleDateString(lng), PW - M, 32, { align: 'right' })

  // Big numbers.
  let y = 96
  const stats: [string, string][] = [
    [t('pdf.pleat.statPleatWidth'), f(l.pleatWidth)],
    [t('pdf.pleat.statSpaceWidth'), f(l.spaceWidth)],
    [t('pdf.pleat.statPleats'), String(l.pleats)],
    [t('pdf.pleat.statSpaces'), String(l.spaces)],
    [t('pdf.pleat.statPins'), String(l.pins)],
  ]
  const sw = CW / stats.length
  stats.forEach(([k, v], i) => {
    const x = M + i * sw
    doc.setFont(font, 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(k, x, y)
    doc.setTextColor(...INK)
    doc.setFontSize(18)
    doc.text(clean(v), x, y + 22)
  })
  y += 40

  // Inputs.
  doc.setDrawColor(...RULE)
  doc.line(M, y, M + CW, y)
  y += 18
  const inputs: [string, string][] = [
    [t('pdf.pleat.hemmed'), f(w.hemmed)],
    [t('pdf.pleat.finished'), f(w.finished)],
    [t('pdf.pleat.return'), f(w.ret)],
    [t('pdf.pleat.leadEdge'), f(w.lead)],
  ]
  inputs.forEach(([k, v], i) => {
    const x = M + (i % 2) * (CW / 2)
    const yy = y + Math.floor(i / 2) * 18
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(k, x, yy)
    doc.setFont(font, 'bold')
    doc.setTextColor(...INK)
    doc.text(clean(v), x + 190, yy)
  })
  y += 44
  doc.setFont(font, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(
    clean(t('pdf.pleat.pinsNote', { pins: l.pins, total: f(l.total), hemmed: f(w.hemmed) })),
    M,
    y,
  )
  y += 26

  // Diagram, as seen from the room.
  const segs = segments(l, w.ret, w.lead)
  const barH = 44
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.pleat.layoutTitle'), M, y)
  y += 13
  doc.setFont(font, 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(clean(drawText(t, w.draw)), M, y)
  y += 14
  if (w.draw === 'both') {
    const half = (CW - 16) / 2
    drawBar(doc, font, mirrored(segs), M, y, half, barH, t('pdf.pleat.return'), t('pdf.pleat.leadEdge'), t('pdf.pleat.leftPanel'))
    drawBar(doc, font, segs, M + half + 16, y, half, barH, t('pdf.pleat.leadEdge'), t('pdf.pleat.return'), t('pdf.pleat.rightPanel'))
  } else if (w.draw === 'left') {
    drawBar(doc, font, mirrored(segs), M, y, CW, barH, t('pdf.pleat.return'), t('pdf.pleat.leadEdge'))
  } else {
    drawBar(doc, font, segs, M, y, CW, barH, t('pdf.pleat.leadEdge'), t('pdf.pleat.return'))
  }
  y += barH + 36
  // Legend.
  ;(
    [
      ['lead', t('pdf.pleat.legendLead')],
      ['pleat', t('pdf.pleat.legendPleat')],
      ['space', t('pdf.pleat.legendSpace')],
    ] as const
  ).forEach(([k, label], i) => {
    const x = M + i * 130
    doc.setFillColor(...(FILL[k] as unknown as [number, number, number]))
    doc.setDrawColor(150, 150, 150)
    doc.rect(x, y - 8, 12, 10, 'FD')
    doc.setFont(font, 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(label, x + 16, y)
  })
  doc.setFillColor(...PIN)
  doc.circle(M + 3 * 130 + 6, y - 3, 2.6, 'F')
  doc.text(t('pdf.pleat.legendPin'), M + 3 * 130 + 16, y)
  y += 28

  // Marking guide: every mark measured from the lead edge, in order.
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.pleat.markingTitle'), M, y)
  y += 8
  const marks = [0, ...segs.map((s) => s.from + s.width)]
  const cols = [M, M + 110]
  doc.setFillColor(...HEADER)
  doc.rect(M, y, CW, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  ;[t('pdf.pleat.colMarkAt'), t('pdf.pleat.colNote')].forEach((h, i) => doc.text(h, cols[i] + 6, y + 11))
  y += 16
  marks.forEach((m, k) => {
    if (y + 16 > PH - M) {
      doc.addPage()
      y = M
    }
    if (k % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(M, y, CW, 16, 'F')
    }
    const note = k === 0 ? t('pdf.pleat.leadEdge') : k === marks.length - 1 ? t('pdf.pleat.return') : ''
    doc.setFont(font, note ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(clean(f(m)), cols[0] + 6, y + 11.5)
    if (note) doc.text(note, cols[1] + 6, y + 11.5)
    y += 16
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(t('pdf.pleat.footer'), M, PH - 20)
    doc.text(t('pdf.common.page', { n: p, total: pages }), PW - M, PH - 20, { align: 'right' })
  }
  return doc
}

/** One panel as a bar of pieces with pins under it. */
function drawBar(doc: JsPDF, font: string, segs: Segment[], x0: number, y: number, width: number, barH: number, leftLabel: string, rightLabel: string, title?: string) {
  const total = segs.reduce((n, s) => n + s.width, 0)
  const sc = width / total
  doc.setFont(font, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  if (title) doc.text(title, x0 + width / 2, y + 4, { align: 'center' })
  doc.text(leftLabel, x0, y + 4)
  doc.text(rightLabel, x0 + width, y + 4, { align: 'right' })
  const top = y + 10
  segs.forEach((s) => {
    const x = x0 + s.from * sc
    const wpx = s.width * sc
    doc.setFillColor(...(FILL[s.type] as unknown as [number, number, number]))
    doc.setDrawColor(150, 150, 150)
    doc.setLineWidth(0.6)
    doc.rect(x, top, wpx, barH, 'FD')
    if (wpx > 18) {
      doc.setFont(font, 'normal')
      doc.setFontSize(wpx > 30 ? 8 : 6.5)
      doc.setTextColor(...INK)
      doc.text(clean(f(s.width)), x + wpx / 2, top + barH / 2 + 3, { align: 'center' })
    }
  })
  // Pins: each end of the panel and the centre of every pleat.
  const pins = [0, ...segs.filter((s) => s.type === 'pleat').map((s) => s.from + s.width / 2), total]
  doc.setFillColor(...PIN)
  doc.setDrawColor(...PIN)
  pins.forEach((p) => {
    const x = x0 + p * sc
    doc.line(x, top + barH, x, top + barH + 8)
    doc.circle(x, top + barH + 11, 2.6, 'F')
  })
}
