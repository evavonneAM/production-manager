import type { jsPDF as JsPDF } from 'jspdf'
import { formatInches as f } from './inches'
import { mirrored, segments, type DrawDirection, type PleatLayout, type Segment } from './draperyPleat'

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

const DRAW_TEXT: Record<DrawDirection, string> = {
  right: 'Draws right - lead edge on the left, return on the right (as seen from the room)',
  left: 'Draws left - return on the left, lead edge on the right (as seen from the room)',
  both: 'Pair - make 2 panels, mirror images. Lead edges meet in the center, returns at each end.',
}

// Letter, points. English only: jsPDF's built-in font has no Cyrillic.
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
  const base = [w.job, w.name].filter(Boolean).join(' - ') || 'Drapery panel'
  buildPleatWorkOrder(new jsPDF({ unit: 'pt', format: 'letter' }), w).save(`${base} - pleat layout.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
}

export function buildPleatWorkOrder(doc: JsPDF, w: PleatWorkOrder): JsPDF {
  const l = w.layout
  // Header.
  doc.setFillColor(...HEADER)
  doc.rect(0, 0, PW, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Drapery Pleat Layout', M, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(clean([w.job, w.name].filter(Boolean).join('   |   ') || 'Single panel'), M, 50)
  doc.text(new Date().toLocaleDateString('en-US'), PW - M, 32, { align: 'right' })

  // Big numbers.
  let y = 96
  const stats: [string, string][] = [
    ['PLEAT WIDTH', f(l.pleatWidth)],
    ['SPACE WIDTH', f(l.spaceWidth)],
    ['PLEATS', String(l.pleats)],
    ['SPACES', String(l.spaces)],
    ['PINS', String(l.pins)],
  ]
  const sw = CW / stats.length
  stats.forEach(([k, v], i) => {
    const x = M + i * sw
    doc.setFont('helvetica', 'bold')
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
    ['Hemmed width (before pleating)', f(w.hemmed)],
    ['Finished width (after pleating)', f(w.finished)],
    ['Return', f(w.ret)],
    ['Lead edge', f(w.lead)],
  ]
  inputs.forEach(([k, v], i) => {
    const x = M + (i % 2) * (CW / 2)
    const yy = y + Math.floor(i / 2) * 18
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(k, x, yy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...INK)
    doc.text(clean(v), x + 190, yy)
  })
  y += 44
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(
    clean(`Pins: 1 at the lead edge + 1 per pleat + 1 at the return = ${l.pins}.   Layout adds up to ${f(l.total)} (hemmed ${f(w.hemmed)}).`),
    M,
    y,
  )
  y += 26

  // Diagram, as seen from the room.
  const segs = segments(l, w.ret, w.lead)
  const barH = 44
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('LAYOUT (AS SEEN FROM THE ROOM)', M, y)
  y += 13
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  doc.text(clean(DRAW_TEXT[w.draw]), M, y)
  y += 14
  if (w.draw === 'both') {
    const half = (CW - 16) / 2
    drawBar(doc, mirrored(segs), M, y, half, barH, 'Return', 'Lead edge', 'LEFT PANEL')
    drawBar(doc, segs, M + half + 16, y, half, barH, 'Lead edge', 'Return', 'RIGHT PANEL')
  } else if (w.draw === 'left') {
    drawBar(doc, mirrored(segs), M, y, CW, barH, 'Return', 'Lead edge')
  } else {
    drawBar(doc, segs, M, y, CW, barH, 'Lead edge', 'Return')
  }
  y += barH + 36
  // Legend.
  ;(
    [
      ['lead', 'Lead edge / return'],
      ['pleat', 'Pleat'],
      ['space', 'Space'],
    ] as const
  ).forEach(([k, label], i) => {
    const x = M + i * 130
    doc.setFillColor(...(FILL[k] as unknown as [number, number, number]))
    doc.setDrawColor(150, 150, 150)
    doc.rect(x, y - 8, 12, 10, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...INK)
    doc.text(label, x + 16, y)
  })
  doc.setFillColor(...PIN)
  doc.circle(M + 3 * 130 + 6, y - 3, 2.6, 'F')
  doc.text('Pin', M + 3 * 130 + 16, y)
  y += 28

  // Marking guide: every mark measured from the lead edge, in order.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('MARKING GUIDE (MEASURED FROM THE LEAD EDGE)', M, y)
  y += 8
  const marks = [0, ...segs.map((s) => s.from + s.width)]
  const cols = [M, M + 110]
  doc.setFillColor(...HEADER)
  doc.rect(M, y, CW, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  ;['MARK AT', 'NOTE'].forEach((h, i) => doc.text(h, cols[i] + 6, y + 11))
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
    const note = k === 0 ? 'Lead edge' : k === marks.length - 1 ? 'Return' : ''
    doc.setFont('helvetica', note ? 'bold' : 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(...INK)
    doc.text(clean(f(m)), cols[0] + 6, y + 11.5)
    if (note) doc.text(note, cols[1] + 6, y + 11.5)
    y += 16
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Pleat and space widths round to the nearest 1/8".', M, PH - 20)
    doc.text(`Page ${p} of ${pages}`, PW - M, PH - 20, { align: 'right' })
  }
  return doc
}

/** One panel as a bar of pieces with pins under it. */
function drawBar(doc: JsPDF, segs: Segment[], x0: number, y: number, width: number, barH: number, leftLabel: string, rightLabel: string, title?: string) {
  const total = segs.reduce((n, s) => n + s.width, 0)
  const sc = width / total
  doc.setFont('helvetica', 'bold')
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
      doc.setFont('helvetica', 'normal')
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
