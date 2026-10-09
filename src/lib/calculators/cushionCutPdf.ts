import type { jsPDF as JsPDF } from 'jspdf'
import {
  BIAS_STRIP_LENGTH,
  cordingByFabric,
  cordingStrips,
  formatInches,
  type CushionCuts,
  type FoamWrap,
  type ZipperStyle,
} from './cushionCut'

export type FabricDirection = 'none' | 'railroaded' | 'upTheRoll'

export type WorkOrderJob = { client: string; workOrder: string; sidemark: string }

export type WorkOrderCushion = {
  name: string
  qty: number
  fabric: string
  style: ZipperStyle
  direction: FabricDirection
  width: number
  depth: number
  height: number
  foamWrap: FoamWrap
  foamNotes: string
  cuts: CushionCuts
}

// Letter, points. English only for now: jsPDF's built-in font has no Cyrillic.
const PW = 612
const PH = 792
const M = 40
const CW = PW - 2 * M
const INK: [number, number, number] = [20, 24, 31]
const MUTED: [number, number, number] = [96, 104, 116]
const RULE: [number, number, number] = [210, 214, 220]
const ACCENT: [number, number, number] = [22, 119, 255]
const HEADER: [number, number, number] = [0, 21, 41]

const STYLE_TEXT: Record<ZipperStyle, string> = { back: 'Back zipper', wrap: 'Wrap-around zipper' }
const WRAP_TEXT: Record<FoamWrap, string> = {
  none: 'No wrap',
  lightDacron: 'Lightweight Dacron',
  heavyDacron: 'Heavyweight Dacron',
  envelope: 'Envelope',
}
const DIRECTION_TEXT: Record<FabricDirection, string> = { none: '', railroaded: 'Railroaded', upTheRoll: 'Up the roll' }

const clean = (s: string) =>
  s.replace(/[″”“]/g, '"').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/×/g, 'x')

/** Builds the cushion work order and starts the download. */
export async function downloadCushionWorkOrder(job: WorkOrderJob, cushions: WorkOrderCushion[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = buildCushionWorkOrder(new jsPDF({ unit: 'pt', format: 'letter' }), job, cushions)
  const base = [job.workOrder, job.sidemark || job.client].filter(Boolean).join(' - ') || 'Cushions'
  doc.save(`${base} - cushion work order.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
}

export function buildCushionWorkOrder(doc: JsPDF, job: WorkOrderJob, cushions: WorkOrderCushion[]): JsPDF {
  const date = new Date().toLocaleDateString('en-US')
  const jobLine = [job.workOrder, job.client, job.sidemark && `Sidemark: ${job.sidemark}`]
    .filter(Boolean)
    .join('   |   ')

  let y = 0
  const header = (first: boolean) => {
    doc.setFillColor(...HEADER)
    doc.rect(0, 0, PW, first ? 64 : 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(first ? 18 : 11)
    doc.text('Cushion Work Order', M, first ? 32 : 22)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    if (first) doc.text(clean(jobLine || 'No job details entered'), M, 50)
    doc.text(date, PW - M, first ? 32 : 22, { align: 'right' })
    y = first ? 88 : 56
  }
  header(true)

  // Summary: cushions and cording strips, grouped by fabric.
  const byFabric = cordingByFabric(cushions.map((c) => ({ fabric: c.fabric, cording: c.cuts.cording })))
  const cols = [M, M + CW * 0.34, M + CW * 0.8]
  doc.setFillColor(...HEADER)
  doc.rect(M, y - 11, CW, 17, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('FABRIC', cols[0] + 6, y + 1)
  doc.text('CUSHIONS', cols[1] + 6, y + 1)
  doc.text(`CORDING STRIPS (${BIAS_STRIP_LENGTH}")`, cols[2] + 6, y + 1)
  y += 6
  byFabric.forEach((f, k) => {
    const list = cushions
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.fabric.trim() === f.fabric)
      .map(({ c, i }) => `${c.qty} x ${c.name || `Cushion ${i + 1}`}`)
      .join(', ')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const fabricLines = doc.splitTextToSize(clean(f.fabric || 'No fabric entered'), cols[1] - cols[0] - 12) as string[]
    const listLines = doc.splitTextToSize(clean(list), cols[2] - cols[1] - 12) as string[]
    const h = Math.max(fabricLines.length, listLines.length) * 12.5 + 9
    if (k % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(M, y, CW, h, 'F')
    }
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    fabricLines.forEach((l, j) => doc.text(l, cols[0] + 6, y + 14 + j * 12.5))
    doc.setFont('helvetica', 'normal')
    listLines.forEach((l, j) => doc.text(l, cols[1] + 6, y + 14 + j * 12.5))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(String(f.strips), cols[2] + 6, y + 14)
    y += h
  })
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.8)
  y += 16
  doc.setDrawColor(...RULE)
  doc.setLineWidth(1)
  doc.line(M, y, M + CW, y)
  y += 18

  const BLOCK_H = 320
  cushions.forEach((c, i) => {
    if (y + BLOCK_H > PH - M) {
      doc.addPage()
      header(false)
    }
    drawCushion(doc, c, i, y)
    y += BLOCK_H
  })

  // Page numbers.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${p} of ${pages}`, PW - M, PH - 20, { align: 'right' })
    if (jobLine) doc.text(clean(jobLine), M, PH - 20)
  }

  return doc
}

function drawCushion(doc: JsPDF, c: WorkOrderCushion, i: number, top: number) {
  let y = top
  // Title row.
  doc.setFillColor(...ACCENT)
  doc.rect(M, y - 11, 4, 16, 'F')
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  const title = `${c.name || `Cushion ${i + 1}`}   x ${c.qty}`
  doc.text(clean(title), M + 12, y + 2)
  const chips = [STYLE_TEXT[c.style], DIRECTION_TEXT[c.direction]].filter(Boolean)
  doc.setFontSize(9)
  let cx = PW - M
  chips
    .slice()
    .reverse()
    .forEach((chip) => {
      const w = doc.getTextWidth(chip) + 14
      cx -= w
      doc.setDrawColor(...ACCENT)
      doc.setTextColor(...ACCENT)
      doc.roundedRect(cx, y - 10, w, 15, 3, 3, 'S')
      doc.text(chip, cx + 7, y + 1)
      cx -= 6
    })
  y += 18
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(clean(`Fabric: ${c.fabric || '-'}`), M + 12, y)
  y += 14

  // Left: plan view + side view. Right: specs + cut list.
  const drawW = 250
  drawPlan(doc, c, M + 12, y + 6, drawW, 150)
  drawSide(doc, c, M + 12, y + 186, drawW, 50)

  const rx = M + 12 + drawW + 30
  const rw = PW - M - rx
  let ry = y + 10
  const spec = (k: string, v: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(k, rx, ry)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(clean(v), rx, ry + 13)
    ry += 30
  }
  spec('ORDERED SIZE (W x D x H)', `${formatInches(c.width)} x ${formatInches(c.depth)} x ${formatInches(c.height)}`)
  spec('FINISHED BOXING HEIGHT', `${formatInches(c.cuts.finishedHeight)}  (${formatInches(c.cuts.deduction)} less than ordered)`)

  // Cut list table.
  ry += 2
  const cols = [rx, rx + rw * 0.42, rx + rw * 0.56]
  doc.setFillColor(...HEADER)
  doc.rect(rx, ry - 10, rw, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('PIECE', cols[0] + 5, ry + 1)
  doc.text('QTY', cols[1] + 5, ry + 1)
  doc.text('CUT SIZE', cols[2] + 5, ry + 1)
  ry += 6
  const rows: [string, string, string][] = [
    ['Plates (W x D)', String(c.cuts.plate.qty), `${formatInches(c.cuts.plate.width)} x ${formatInches(c.cuts.plate.depth)}`],
    ['Boxing (X x Z)', String(c.cuts.boxing.qty), `${formatInches(c.cuts.boxing.x)} x ${formatInches(c.cuts.boxing.z)}`],
    ['Zipper (X x Z)', String(c.cuts.zipper.qty), `${formatInches(c.cuts.zipper.x)} x ${formatInches(c.cuts.zipper.z)}`],
    ['Cording', '', `${formatInches(c.cuts.cording)}  (${cordingStrips(c.cuts.cording)} strips)`],
    ['Foam (W x D x H)', String(c.cuts.foam.qty), `${formatInches(c.cuts.foam.width)} x ${formatInches(c.cuts.foam.depth)} x ${formatInches(c.cuts.foam.height)}`],
  ]
  rows.forEach(([a, b, s], k) => {
    if (k % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(rx, ry, rw, 20, 'F')
    }
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(a, cols[0] + 5, ry + 14)
    doc.text(b, cols[1] + 5, ry + 14)
    doc.setFont('helvetica', 'bold')
    doc.text(clean(s), cols[2] + 5, ry + 14)
    ry += 20
  })
  doc.setDrawColor(...RULE)
  doc.rect(rx, ry - 20 * rows.length - 16, rw, 20 * rows.length + 16, 'S')

  // Foam wrap + project manager's notes.
  ry += 14
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('FOAM', rx, ry)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  const foamLines = doc
    .splitTextToSize(clean(`Wrap: ${WRAP_TEXT[c.foamWrap]}${c.foamNotes ? `. ${c.foamNotes}` : ''}`), rw)
    .slice(0, 4) as string[]
  foamLines.forEach((l, k) => doc.text(l, rx, ry + 12 + k * 11.5))

  // Divider under the block.
  doc.setDrawColor(...RULE)
  doc.line(M, top + 308, M + CW, top + 308)
}

/** Plan (top) view: width across, depth down, zipper on the back edge. */
function drawPlan(doc: JsPDF, c: WorkOrderCushion, x0: number, y0: number, boxW: number, boxH: number) {
  const pad = 30
  const sc = Math.min((boxW - pad * 2) / c.width, (boxH - pad * 1.6) / c.depth)
  const w = c.width * sc
  const d = c.depth * sc
  const x = x0 + (boxW - w) / 2
  const y = y0 + 22

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('PLAN VIEW', x0, y0)

  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.2)
  doc.roundedRect(x, y, w, d, 4, 4, 'FD')

  // Zipper: back edge only, or back + halfway down each side.
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(3)
  const inset = Math.min(1.5 * sc, w * 0.1)
  if (c.style === 'back') {
    doc.line(x + inset, y, x + w - inset, y)
  } else {
    doc.line(x, y + d / 2, x, y)
    doc.line(x, y, x + w, y)
    doc.line(x + w, y, x + w, y + d / 2)
  }
  doc.setLineWidth(1)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text('BACK - ZIPPER', x + w / 2, y + 12, { align: 'center' })
  doc.setTextColor(...MUTED)
  doc.text('FRONT', x + w / 2, y + d + 11, { align: 'center' })

  // Width dimension (above), depth dimension (right).
  dim(doc, x, y - 7, x + w, y - 7, `${formatInches(c.width)} W`)
  const rx = x + w + 10
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(rx, y, rx, y + d)
  doc.line(rx - 3, y, rx + 3, y)
  doc.line(rx - 3, y + d, rx + 3, y + d)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(clean(`${formatInches(c.depth)} D`), rx + 5, y + d / 2 + 3)
}

/** Side view: width across, ordered vs finished boxing height. */
function drawSide(doc: JsPDF, c: WorkOrderCushion, x0: number, y0: number, boxW: number, boxH: number) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text('SIDE VIEW', x0, y0)
  const sc = Math.min((boxW - 60) / c.width, (boxH - 10) / c.height)
  const w = c.width * sc
  const h = c.height * sc
  const fh = c.cuts.finishedHeight * sc
  const x = x0 + (boxW - w) / 2
  const y = y0 + 8
  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.2)
  doc.roundedRect(x, y + (h - fh), w, fh, 3, 3, 'FD')
  doc.setLineDashPattern([2, 2], 0)
  doc.setLineWidth(0.6)
  doc.rect(x, y, w, h, 'S')
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(clean(`${formatInches(c.cuts.finishedHeight)} finished`), x + w + 6, y + h - fh / 2 + 3)
  doc.setTextColor(...MUTED)
  doc.text(clean(`${formatInches(c.height)} ordered (dashed)`), x0, y + h + 14)
}

function dim(doc: JsPDF, x1: number, y1: number, x2: number, y2: number, label: string) {
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(x1, y1, x2, y2)
  doc.line(x1, y1 - 3, x1, y1 + 3)
  doc.line(x2, y2 - 3, x2, y2 + 3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const mid = (x1 + x2) / 2
  const tw = doc.getTextWidth(clean(label)) + 6
  doc.setFillColor(255, 255, 255)
  doc.rect(mid - tw / 2, y1 - 6, tw, 10, 'F')
  doc.text(clean(label), mid, y1 + 3, { align: 'center' })
}
