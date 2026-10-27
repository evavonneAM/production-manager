import type { jsPDF as JsPDF } from 'jspdf'
import {
  BIAS_STRIP_LENGTH,
  cordingByFabric,
  cordingStrips,
  zipperWrap,
  formatInches,
  type AnyCuts,
  type BoardCuts,
  type CushionCuts,
  type FoamWrap,
  type WedgeCuts,
  type ZipperStyle,
} from './cushionCut'
import type { FabricPlan } from './fabricNesting'
import { pdfFont, pdfLanguage, translateForPdf, type PdfT } from '../pdfText'

export type FabricDirection = 'none' | 'railroaded' | 'upTheRoll'

export type WorkOrderJob = { client: string; workOrder: string; sidemark: string; notes?: string }

export type WorkOrderCushion = {
  name: string
  qty: number
  fabric: string
  style: ZipperStyle
  /** Sewing style, as on the estimate (e.g. Boxed/Self Welted). */
  sewingStyle: string
  direction: FabricDirection
  width: number
  depth: number
  height: number
  /** Wedge only: thin (top) end. For a wedge, width = length and depth = deep (bottom) end. */
  top: number
  foamWrap: FoamWrap
  foamNotes: string
  cuts: AnyCuts
}

/** The PDF's language and font. */
export type CushionPdfOptions = { t: PdfT; lng: string; font: string; notesTranslated?: boolean }

// Letter, points.
const PW = 612
const PH = 792
const M = 40
const CW = PW - 2 * M
const INK: [number, number, number] = [20, 24, 31]
const MUTED: [number, number, number] = [96, 104, 116]
const RULE: [number, number, number] = [210, 214, 220]
const ACCENT: [number, number, number] = [22, 119, 255]
const HEADER: [number, number, number] = [0, 21, 41]

const STYLE_TEXT = (t: PdfT): Record<ZipperStyle, string> => ({
  back: t('pdf.cushion.style_back'),
  wrap: t('pdf.cushion.style_wrap'),
  bottom: t('pdf.cushion.style_bottom'),
})
const WRAP_TEXT = (t: PdfT): Record<FoamWrap, string> => ({
  none: t('pdf.cushion.wrap_none'),
  lightDacron: t('pdf.cushion.wrap_lightDacron'),
  heavyDacron: t('pdf.cushion.wrap_heavyDacron'),
  envelope: t('pdf.cushion.wrap_envelope'),
})
const DIRECTION_TEXT = (t: PdfT): Record<FabricDirection, string> => ({
  none: '',
  railroaded: t('pdf.cushion.railroaded'),
  upTheRoll: t('pdf.cushion.upTheRoll'),
})

const PIECE_TEXT = (t: PdfT): Record<string, string> => ({
  plate: t('pdf.cushion.piece_plate'),
  boxing: t('pdf.cushion.piece_boxing'),
  zipper: t('pdf.cushion.piece_zipper'),
  wedgePanel: t('pdf.cushion.piece_wedgePanel'),
  wedgeSide: t('pdf.cushion.piece_wedgeSide'),
  sparePlate: t('pdf.cushion.piece_sparePlate'),
})
const FILL: [number, number, number][] = [
  [212, 227, 242],
  [246, 227, 200],
  [217, 238, 219],
  [238, 220, 242],
  [245, 214, 214],
  [214, 239, 240],
  [236, 233, 207],
  [226, 226, 226],
]
const STROKE: [number, number, number][] = [
  [22, 119, 255],
  [212, 136, 6],
  [56, 158, 13],
  [146, 84, 222],
  [207, 19, 34],
  [8, 151, 156],
  [124, 111, 0],
  [89, 89, 89],
]
const f2 = (n: number) => formatInches(n)
const PART_TEXT = (t: PdfT) =>
  ({
    front: t('pdf.cushion.part_front'),
    sides: t('pdf.cushion.part_sides'),
    frontBack: t('pdf.cushion.part_frontBack'),
  }) as const
/** Cut-list rows for the boxing: one strip, or the pieces when it is seamed at the corners. */
const boxingRows = (t: PdfT, k: CushionCuts | BoardCuts, label: string): [string, string, string][] =>
  k.boxingParts
    ? k.boxingParts.map((b) => [PART_TEXT(t)[b.part], String(b.qty), `${f2(b.x)} x ${f2(b.z)}`])
    : [[label, String(k.boxing.qty), `${f2(k.boxing.x)} x ${f2(k.boxing.z)}`]]

const clean = (s: string) =>
  s.replace(/[″”“]/g, '"').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/×/g, 'x')

/** One fabric's roll layout for the work order: every cushion in that fabric on one roll. */
export type WorkOrderFabric = { fabric: string; names: string[]; plan: FabricPlan }

/** Builds the cushion work order and starts the download. */
export async function downloadCushionWorkOrder(job: WorkOrderJob, cushions: WorkOrderCushion[], fabrics: WorkOrderFabric[] = []): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const blank = new jsPDF({ unit: 'pt', format: 'letter' })
  const font = await pdfFont(blank)
  const { t, lng } = pdfLanguage()
  // Notes are typed in whatever language the writer uses; print them in the reader's.
  const [notes, ...foam] = await translateForPdf([job.notes ?? '', ...cushions.map((c) => c.foamNotes)], lng)
  const mark = (n: { text: string; translated: boolean }) => (n.translated ? `${n.text} (${t('pdf.common.translated')})` : n.text)
  const doc = buildCushionWorkOrder(
    blank,
    { ...job, notes: notes.text },
    cushions.map((c, i) => ({ ...c, foamNotes: foam[i].text && mark(foam[i]) })),
    fabrics,
    { t, lng, font, notesTranslated: notes.translated },
  )
  const base = [job.workOrder, job.sidemark || job.client].filter(Boolean).join(' - ') || t('pdf.cushion.defaultName')
  doc.save(`${t('pdf.cushion.fileName', { base })}.pdf`.replace(/[\\/:*?"<>|]/g, '-'))
}

export function buildCushionWorkOrder(
  doc: JsPDF,
  job: WorkOrderJob,
  cushions: WorkOrderCushion[],
  fabrics: WorkOrderFabric[],
  o: CushionPdfOptions,
): JsPDF {
  const { t, lng, font } = o
  const pieceText = PIECE_TEXT(t)
  const date = new Date().toLocaleDateString(lng)
  const jobLine = [job.workOrder, job.client, job.sidemark && t('pdf.cushion.sidemark', { v: job.sidemark })]
    .filter(Boolean)
    .join('   |   ')

  let y = 0
  const header = (first: boolean) => {
    doc.setFillColor(...HEADER)
    doc.rect(0, 0, PW, first ? 64 : 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(font, 'bold')
    doc.setFontSize(first ? 18 : 11)
    doc.text(t('pdf.cushion.title'), M, first ? 32 : 22)
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    if (first) doc.text(clean(jobLine || t('pdf.cushion.noJob')), M, 50)
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
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  doc.text(t('pdf.cushion.colFabric'), cols[0] + 6, y + 1)
  doc.text(t('pdf.cushion.colCushions'), cols[1] + 6, y + 1)
  doc.text(t('pdf.cushion.colCordingStrips', { len: BIAS_STRIP_LENGTH }), cols[2] + 6, y + 1)
  y += 6
  byFabric.forEach((f, k) => {
    const list = cushions
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.fabric.trim() === f.fabric)
      .map(({ c, i }) => `${c.qty} x ${c.name || t('pdf.cushion.cushionN', { n: i + 1 })}`)
      .join(', ')
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    const fabricLines = doc.splitTextToSize(clean(f.fabric || t('pdf.cushion.noFabric')), cols[1] - cols[0] - 12) as string[]
    const listLines = doc.splitTextToSize(clean(list), cols[2] - cols[1] - 12) as string[]
    const h = Math.max(fabricLines.length, listLines.length) * 12.5 + 9
    if (k % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(M, y, CW, h, 'F')
    }
    doc.setTextColor(...INK)
    doc.setFont(font, 'bold')
    fabricLines.forEach((l, j) => doc.text(l, cols[0] + 6, y + 14 + j * 12.5))
    doc.setFont(font, 'normal')
    listLines.forEach((l, j) => doc.text(l, cols[1] + 6, y + 14 + j * 12.5))
    doc.setFont(font, 'bold')
    doc.setFontSize(12)
    doc.text(f.strips ? String(f.strips) : t('pdf.cushion.noCording'), cols[2] + 6, y + 14)
    y += h
  })
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.8)
  y += 16

  // Project manager's notes for the whole job.
  const notes = job.notes?.trim()
  if (notes) {
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(clean(notes), CW - 20) as string[]
    const h = 26 + lines.length * 13 + (o.notesTranslated ? 13 : 0)
    doc.setFillColor(255, 248, 230)
    doc.setDrawColor(...RULE)
    doc.rect(M, y, CW, h, 'FD')
    doc.setFont(font, 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(t('pdf.cushion.notesTitle'), M + 10, y + 14)
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    lines.forEach((l, k) => doc.text(l, M + 10, y + 28 + k * 13))
    if (o.notesTranslated) {
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text(t('pdf.common.translatedNote'), M + 10, y + 28 + lines.length * 13)
    }
    y += h + 16
  }

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
    drawCushion(doc, c, i, y, o)
    y += BLOCK_H
  })

  // Fabric layouts: each fabric's roll, wrapped into rows of up to 5 yards.
  fabrics.forEach((f) => {
    const plan = f.plan
    if (plan.totalLength <= 0) return
    const ROW = 180
    const sc = CW / ROW
    const rowH = plan.width * sc
    const rows = Math.ceil(plan.totalLength / ROW - 1e-9)
    const blockH = 44 + rows * (rowH + 30) + (plan.pattern ? 14 : 0)
    if (y + Math.min(blockH, 44 + rowH + 30) > PH - M) {
      doc.addPage()
      header(false)
    }
    doc.setFillColor(...ACCENT)
    doc.rect(M, y - 11, 4, 16, 'F')
    doc.setTextColor(...INK)
    doc.setFont(font, 'bold')
    doc.setFontSize(14)
    doc.text(clean(t('pdf.cushion.fabricLayout', { fabric: f.fabric || t('pdf.cushion.noFabric') })), M + 12, y + 2)
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    const how = [
      t('pdf.cushion.toOrder', { yards: plan.orderYards }),
      plan.direction === 'railroaded' ? t('pdf.cushion.railroaded') : t('pdf.cushion.upTheRoll'),
      plan.pattern
        ? plan.pattern.halfDrop
          ? t('pdf.cushion.repeatHalfDrop', { size: f2(plan.pattern.vertical) })
          : t('pdf.cushion.repeat', { size: f2(plan.pattern.vertical) })
        : '',
      t('pdf.cushion.usableWidth', { size: f2(plan.width) }),
    ].filter(Boolean)
    doc.text(clean(how.join('   |   ')), M + 12, y + 18)
    if (f.names.length > 1) doc.text(clean(f.names.join(', ')), M + 12, y + 31, { maxWidth: CW - 12 })
    y += f.names.length > 1 ? 50 : 38
    // Pieces too long for the roll are seamed: say so, so the cutter isn't surprised.
    const joins = [
      ...plan.joined.map((j) =>
        t('pdf.cushion.joined', {
          name: `${j.cushion ? `${j.cushion}: ` : ''}${pieceText[j.name] ?? j.name}${j.count > 1 ? ` x ${j.count}` : ''}`,
          n: j.pieces,
          sizes: j.center === j.end ? f2(j.center) : `${f2(j.center)} + 2 x ${f2(j.end)}`,
        }),
      ),
      // One line per cushion, piece and size, not one per copy of the piece.
      ...[
        ...plan.tooWide
          .reduce((m, p) => {
            const key = `${p.cushion}|${p.name}|${Math.max(p.across, p.along)}`
            m.set(key, { p, n: (m.get(key)?.n ?? 0) + 1 })
            return m
          }, new Map<string, { p: (typeof plan.tooWide)[number]; n: number }>())
          .values(),
      ].map(({ p, n }) =>
        t('pdf.cushion.notOnLayout', {
          name: `${n > 1 ? `${n} x ` : ''}${p.cushion ? `${p.cushion}: ` : ''}${pieceText[p.name] ?? p.name}`,
          size: f2(Math.max(p.across, p.along)),
        }),
      ),
    ]
    if (joins.length) {
      doc.setFontSize(8.5)
      doc.setTextColor(180, 90, 0)
      joins.forEach((l) => {
        doc.text(clean(l), M + 12, y - 4)
        y += 11
      })
      y += 4
    }
    const off = plan.endAllowance
    for (let r = 0; r < rows; r++) {
      if (y + rowH + 22 > PH - M) {
        doc.addPage()
        header(false)
      }
      const r0 = r * ROW
      const r1 = Math.min(plan.totalLength, r0 + ROW)
      const x0 = M
      const top = y + 12
      // Yard marks above the row.
      doc.setFont(font, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      for (let yd = Math.ceil(r0 / 36); yd * 36 <= r1; yd++) {
        const X = x0 + (yd * 36 - r0) * sc
        doc.setDrawColor(...MUTED)
        doc.setLineWidth(0.5)
        doc.line(X, top - 4, X, top)
        doc.text(t('pdf.cushion.yd', { n: yd }), X, top - 6, { align: 'center' })
      }
      doc.setDrawColor(...INK)
      doc.setFillColor(236, 236, 236)
      doc.setLineWidth(0.6)
      doc.rect(x0, top, (r1 - r0) * sc, rowH, 'FD')
      const clip = (a: number, b: number) => [Math.max(a, r0), Math.min(b, r1)] as const
      plan.placed.forEach((p) => {
        // On paper the roll runs left to right: a piece's length along the roll is its width here.
        const [a, b] = clip(off + p.y, off + p.y + p.h)
        if (b - a <= 0.01) return
        const ci = Math.max(0, f.names.indexOf(p.cushion)) % FILL.length
        doc.setFillColor(...FILL[ci])
        doc.setDrawColor(...STROKE[ci])
        doc.setLineWidth(0.5)
        const px = x0 + (a - r0) * sc
        const py = top + p.x * sc
        const pw = (b - a) * sc
        const ph = p.w * sc
        doc.rect(px, py, pw, ph, 'FD')
        const mid = off + p.y + p.h / 2
        if (p.matched && mid >= r0 && mid <= r1) {
          doc.setDrawColor(192, 57, 43)
          doc.circle(x0 + (mid - r0) * sc, py + ph / 2, 2.2, 'S')
        }
        if (pw > 26 && ph > 9) {
          doc.setTextColor(...INK)
          doc.setFontSize(Math.max(5, Math.min(7.5, ph / 2.2)))
          const label = `${f.names.length > 1 && p.cushion ? `${p.cushion}: ` : ''}${pieceText[p.name] ?? p.name}`
          const size = `${f2(p.across)} x ${f2(p.along)}`
          const cx = px + pw / 2
          const lines = (ph > 18 ? [label, size] : [label]).map((l) => (doc.getTextWidth(clean(l)) > pw - 4 ? (doc.splitTextToSize(clean(l), pw - 4) as string[])[0] : clean(l)))
          lines.forEach((l, k) => doc.text(l, cx, py + ph / 2 + 2.5 + (k - (lines.length - 1) / 2) * 8, { align: 'center' }))
        }
      })
      if (plan.cordingLength > 0) {
        const [a, b] = clip(off + plan.piecesLength, off + plan.piecesLength + plan.cordingLength)
        if (b - a > 0.01) {
          doc.setFillColor(255, 247, 230)
          doc.setDrawColor(212, 136, 6)
          doc.rect(x0 + (a - r0) * sc, top, (b - a) * sc, rowH, 'FD')
          doc.setTextColor(135, 77, 0)
          doc.setFontSize(7)
          doc.text(t('pdf.cushion.biasBlock'), x0 + ((a + b) / 2 - r0) * sc, top + rowH / 2, { align: 'center' })
        }
      }
      y = top + rowH + 22
    }
    if (plan.pattern) {
      doc.setFontSize(8)
      doc.setTextColor(...MUTED)
      doc.text(t('pdf.cushion.redRings'), M, y - 8)
      y += 6
    }
    y += 10
  })

  // Page numbers.
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(t('pdf.common.page', { n: p, total: pages }), PW - M, PH - 20, { align: 'right' })
    if (jobLine) doc.text(clean(jobLine), M, PH - 20)
  }

  return doc
}

function drawCushion(doc: JsPDF, c: WorkOrderCushion, i: number, top: number, o: CushionPdfOptions) {
  const { t, font } = o
  let y = top
  // Title row.
  doc.setFillColor(...ACCENT)
  doc.rect(M, y - 11, 4, 16, 'F')
  doc.setTextColor(...INK)
  doc.setFont(font, 'bold')
  doc.setFontSize(14)
  const title = `${c.name || t('pdf.cushion.cushionN', { n: i + 1 })}   x ${c.qty}`
  doc.text(clean(title), M + 12, y + 2)
  const chips = [
    c.cuts.kind === 'wedge' ? t('pdf.cushion.chipWedge') : c.cuts.kind === 'board' ? t('pdf.cushion.chipBoard') : STYLE_TEXT(t)[c.style],
    c.cuts.kind !== 'wedge' && c.cuts.boxingParts ? t('pdf.cushion.chipCornerSeams') : '',
    DIRECTION_TEXT(t)[c.direction],
  ].filter(Boolean)
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
  doc.setFont(font, 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  doc.text(clean(t('pdf.cushion.styleFabric', { style: c.sewingStyle || '-', fabric: c.fabric || '-' })), M + 12, y)
  y += 14

  // Left: plan view + side view. Right: specs + cut list.
  const drawW = 250
  if (c.cuts.kind === 'wedge') {
    drawWedgeProfile(doc, o, c, c.cuts, M + 12, y + 6, drawW, 160)
    drawWedgeFront(doc, o, c, c.cuts, M + 12, y + 196, drawW, 44)
  } else {
    // Plan and side views share one scale so they read true to each other.
    const sc = Math.min((drawW - 100) / c.width, (150 - 48) / c.depth, (50 - 10) / c.height)
    if (c.cuts.kind === 'board') drawBoardPlan(doc, o, c, M + 12, y + 6, drawW, sc)
    else drawPlan(doc, o, c, c.cuts, M + 12, y + 6, drawW, sc)
    drawSide(doc, o, c, c.cuts, M + 12, y + 186, drawW, sc)
  }

  const rx = M + 12 + drawW + 30
  const rw = PW - M - rx
  let ry = y + 10
  const spec = (k: string, v: string) => {
    doc.setFont(font, 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...MUTED)
    doc.text(k, rx, ry)
    doc.setFont(font, 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(clean(v), rx, ry + 13)
    ry += 30
  }
  const f = formatInches
  if (c.cuts.kind === 'wedge') {
    spec(t('pdf.cushion.specWedgeOrdered'), `${f(c.width)} x ${f(c.height)},  ${f(c.depth)} / ${f(c.top)}`)
    spec(t('pdf.cushion.specFinishedLength'), `${f(c.cuts.finishedLength)}  ${t('pdf.cushion.lengthLess', { v: f(c.cuts.deduction) })}`)
  } else if (c.cuts.kind === 'board') {
    spec(t('pdf.cushion.specFinishedSize'), `${f(c.width)} x ${f(c.depth)} x ${f(c.height)}`)
    spec(t('pdf.cushion.specBoard'), `${f(c.cuts.board.width)} x ${f(c.cuts.board.depth)}  ${t('pdf.cushion.boardInset')}`)
  } else {
    spec(t('pdf.cushion.specOrdered'), `${f(c.width)} x ${f(c.depth)} x ${f(c.height)}`)
    spec(
      t('pdf.cushion.specFinishedCover'),
      `${f(c.cuts.finishedWidth)} x ${f(c.cuts.finishedDepth)} x ${f(c.cuts.finishedHeight)}  ${t('pdf.cushion.heightLess', { v: f(c.cuts.deduction) })}`,
    )
  }

  // Cut list table.
  ry += 2
  const cols = [rx, rx + rw * 0.42, rx + rw * 0.56]
  doc.setFillColor(...HEADER)
  doc.rect(rx, ry - 10, rw, 16, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont(font, 'bold')
  doc.setFontSize(8)
  doc.text(t('pdf.cushion.colPiece'), cols[0] + 5, ry + 1)
  doc.text(t('pdf.cushion.colQty'), cols[1] + 5, ry + 1)
  doc.text(t('pdf.cushion.colCutSize'), cols[2] + 5, ry + 1)
  ry += 6
  const cordingRow: [string, string, string][] =
    c.cuts.cording > 0
      ? [[t('pdf.cushion.rowCording'), '', `${f(c.cuts.cording)}  (${t('pdf.cushion.strips', { count: cordingStrips(c.cuts.cording) })})`]]
      : []
  const k = c.cuts
  const rows: [string, string, string][] =
    k.kind === 'box'
      ? [
          ...(k.bottomPlates
            ? ([
                [t('pdf.cushion.rowTopPlate'), String(k.plate.qty), `${f(k.plate.width)} x ${f(k.plate.depth)}`],
                [t('pdf.cushion.rowBottomPlate'), String(k.bottomPlates.qty), t('pdf.cushion.calcPlateWithZipper')],
              ] as [string, string, string][])
            : ([[t('pdf.cushion.rowPlates'), String(k.plate.qty), `${f(k.plate.width)} x ${f(k.plate.depth)}`]] as [string, string, string][])),
          ...boxingRows(t, k, t('pdf.cushion.rowBoxing')),
          ...(k.zipper.qty ? ([[t('pdf.cushion.rowZipper'), String(k.zipper.qty), `${f(k.zipper.x)} x ${f(k.zipper.z)}`]] as [string, string, string][]) : []),
          ...cordingRow,
          [t('pdf.cushion.rowFoam'), String(k.foam.qty), `${f(k.foam.width)} x ${f(k.foam.depth)} x ${f(k.foam.height)}`],
        ]
      : k.kind === 'board'
        ? [
            [t('pdf.cushion.rowPlate'), String(k.plate.qty), `${f(k.plate.width)} x ${f(k.plate.depth)}`],
            ...boxingRows(t, k, t('pdf.cushion.rowBoxingAround')),
            ...cordingRow,
            [t('pdf.cushion.rowFoam'), String(k.foam.qty), `${f(k.foam.width)} x ${f(k.foam.depth)} x ${f(k.foam.height)}`],
          ]
        : [
          [t('pdf.cushion.rowMainPanel'), String(k.panel.qty), `${f(k.panel.width)} x ${f(k.panel.height)}`],
          [t('pdf.cushion.rowSides'), String(k.side.qty), `${f(k.side.height)} x ${f(k.side.top)} / ${f(k.side.bottom)}`],
          [t('pdf.cushion.rowZipperLength'), String(k.zipper.qty), f(k.zipper.length)],
          ...cordingRow,
          [t('pdf.cushion.rowWedgeFoam'), String(k.foam.qty), `${f(k.foam.length)} x ${f(k.foam.height)} x ${f(k.foam.bottom)}/${f(k.foam.top)}`],
        ]
  rows.forEach(([a, b, s], k) => {
    if (k % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(rx, ry, rw, 20, 'F')
    }
    doc.setTextColor(...INK)
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    // Shrink long piece names (translations run longer) to fit the column.
    let ls = 10
    while (ls > 7 && doc.getTextWidth(a) > cols[1] - cols[0] - 6) doc.setFontSize(--ls)
    doc.text(a, cols[0] + 5, ry + 14)
    doc.setFontSize(10)
    doc.text(b, cols[1] + 5, ry + 14)
    doc.setFont(font, 'bold')
    // Shrink long sizes to fit the column.
    let fs = 10
    while (fs > 6 && doc.getTextWidth(clean(s)) > rx + rw - cols[2] - 8) doc.setFontSize(--fs)
    doc.text(clean(s), cols[2] + 5, ry + 14)
    ry += 20
  })
  doc.setDrawColor(...RULE)
  doc.rect(rx, ry - 20 * rows.length - 16, rw, 20 * rows.length + 16, 'S')

  // Foam wrap + project manager's notes.
  ry += 14
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.foamTitle'), rx, ry)
  doc.setFont(font, 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  const foamLines = doc
    .splitTextToSize(clean(`${t('pdf.cushion.wrapLine', { wrap: WRAP_TEXT(t)[c.foamWrap] })}${c.foamNotes ? `. ${c.foamNotes}` : ''}`), rw)
    .slice(0, 4) as string[]
  foamLines.forEach((l, k) => doc.text(l, rx, ry + 12 + k * 11.5))

  // Divider under the block.
  doc.setDrawColor(...RULE)
  doc.line(M, top + 308, M + CW, top + 308)
}

/** Plan (top) view: width across, depth down, zipper on the back edge. */
function drawPlan(doc: JsPDF, { t, font }: CushionPdfOptions, c: WorkOrderCushion, cuts: CushionCuts, x0: number, y0: number, boxW: number, sc: number) {
  const w = c.width * sc
  const d = c.depth * sc
  const x = x0 + (boxW - w) / 2
  const y = y0 + 22

  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.planView'), x0, y0)

  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.2)
  doc.roundedRect(x, y, w, d, 4, 4, 'FD')

  // Zipper: back edge only, or back + 4" up each side.
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(3)
  const inset = Math.min(1.5 * sc, w * 0.1)
  if (c.style === 'bottom') {
    // Zipper is underneath: dashed line across the middle of the plate.
    doc.setLineDashPattern([4, 3], 0)
    doc.line(x + inset, y + d / 2, x + w - inset, y + d / 2)
    doc.setLineDashPattern([], 0)
  } else if (c.style === 'back') {
    doc.line(x + inset, y, x + w - inset, y)
  } else {
    const wrap = zipperWrap(cuts.finishedDepth) * sc
    doc.line(x, y + wrap, x, y)
    doc.line(x, y, x + w, y)
    doc.line(x + w, y, x + w, y + wrap)
  }
  doc.setLineWidth(1)

  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text(c.style === 'bottom' ? t('pdf.cushion.zipperUnder') : t('pdf.cushion.backZipper'), x + w / 2, c.style === 'bottom' ? y + d / 2 - 5 : y + 12, { align: 'center' })
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.front'), x + w / 2, y + d + 11, { align: 'center' })

  // Width dimension (above), depth dimension (right).
  dim(doc, font, x, y - 7, x + w, y - 7, t('pdf.cushion.dimW', { v: formatInches(cuts.finishedWidth) }))
  const rx = x + w + 10
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(rx, y, rx, y + d)
  doc.line(rx - 3, y, rx + 3, y)
  doc.line(rx - 3, y + d, rx + 3, y + d)
  doc.setFont(font, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(clean(t('pdf.cushion.dimD', { v: formatInches(cuts.finishedDepth) })), rx + 5, y + d / 2 + 3)
}

/** Plan (top) view of a board-mounted cushion: no zipper, the boxing wraps under the board. */
function drawBoardPlan(doc: JsPDF, { t, font }: CushionPdfOptions, c: WorkOrderCushion, x0: number, y0: number, boxW: number, sc: number) {
  const w = c.width * sc
  const d = c.depth * sc
  const x = x0 + (boxW - w) / 2
  const y = y0 + 22
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.planViewBoard'), x0, y0)
  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.2)
  doc.roundedRect(x, y, w, d, 4, 4, 'FD')
  doc.setLineWidth(1)
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.backNoZipper'), x + w / 2, y + 12, { align: 'center' })
  doc.text(t('pdf.cushion.front'), x + w / 2, y + d + 11, { align: 'center' })
  dim(doc, font, x, y - 7, x + w, y - 7, t('pdf.cushion.dimW', { v: formatInches(c.width) }))
  const rx = x + w + 10
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(rx, y, rx, y + d)
  doc.line(rx - 3, y, rx + 3, y)
  doc.line(rx - 3, y + d, rx + 3, y + d)
  doc.setFont(font, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(clean(t('pdf.cushion.dimD', { v: formatInches(c.depth) })), rx + 5, y + d / 2 + 3)
}

/** Side view: width across, ordered vs finished boxing height. */
function drawSide(doc: JsPDF, { t, font }: CushionPdfOptions, c: WorkOrderCushion, cuts: { finishedHeight: number }, x0: number, y0: number, boxW: number, sc: number) {
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.sideView'), x0, y0)
  const w = c.width * sc
  const h = c.height * sc
  const fh = cuts.finishedHeight * sc
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
  doc.setFont(font, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...INK)
  doc.text(clean(t('pdf.cushion.finishedDim', { v: formatInches(cuts.finishedHeight) })), x + w + 6, y + h - fh / 2 + 3)
  doc.setTextColor(...MUTED)
  doc.text(clean(t('pdf.cushion.orderedDashed', { v: formatInches(c.height) })), x0, y + h + 14)
}

/** Wedge side piece as cut: solid cut line, dashed sew line (the finished
 *  profile) ½" inside, plumb front, sloped back rest, zipper on the bottom. */
function drawWedgeProfile(doc: JsPDF, { t, font }: CushionPdfOptions, c: WorkOrderCushion, cuts: WedgeCuts, x0: number, y0: number, boxW: number, boxH: number) {
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.sidePiece', { n: cuts.side.qty }), x0, y0)

  const h = c.height
  const b = c.depth
  const tp = c.top
  const sa = 0.5
  const tan = (b - tp) / h
  const sec = cuts.slope / h
  // Cut outline in inches, origin at the finished top-front corner, y down.
  const topRight = tp + sa * sec - sa * tan
  const botRight = b + sa * sec + sa * tan
  const sc = Math.min((boxW - 130) / (botRight + sa), (boxH - 40) / (h + 2 * sa))
  const ox = x0 + 60 + sa * sc
  const oy = y0 + 22 + sa * sc
  const X = (x: number) => ox + x * sc
  const Y = (y: number) => oy + y * sc

  // Cut line.
  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.4)
  doc.lines(
    [
      [(topRight + sa) * sc, 0],
      [(botRight - topRight) * sc, (h + 2 * sa) * sc],
      [-(botRight + sa) * sc, 0],
    ],
    X(-sa),
    Y(-sa),
    [1, 1],
    'FD',
    true,
  )
  // Sew line (finished profile).
  doc.setLineWidth(0.7)
  doc.setLineDashPattern([3, 2], 0)
  doc.lines([[tp * sc, 0], [(b - tp) * sc, h * sc], [-b * sc, 0]], X(0), Y(0), [1, 1], 'S', true)
  doc.setLineDashPattern([], 0)

  // Zipper: centered on the bottom.
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(3)
  doc.line(X(b * 0.2), Y(h + sa), X(b * 0.8), Y(h + sa))
  doc.setLineWidth(1)
  doc.setFont(font, 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ACCENT)
  doc.text(t('pdf.cushion.zipperLabel'), X(b / 2), Y(h + sa) + 10, { align: 'center' })

  // Cut dimensions.
  const f = formatInches
  dim(doc, font, X(-sa), Y(-sa) - 7, X(topRight), Y(-sa) - 7, f(cuts.side.top))
  dim(doc, font, X(-sa), Y(h + sa) + 24, X(botRight), Y(h + sa) + 24, f(cuts.side.bottom))
  const lx = X(-sa) - 10
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(lx, Y(-sa), lx, Y(h + sa))
  doc.line(lx - 3, Y(-sa), lx + 3, Y(-sa))
  doc.line(lx - 3, Y(h + sa), lx + 3, Y(h + sa))
  doc.setFont(font, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  doc.text(clean(f(cuts.side.height)), lx - 4, Y(h / 2) + 3, { align: 'right' })

  // Labels.
  const midX = X((topRight + botRight) / 2) + 10
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(clean(t('pdf.cushion.backRest')), midX, Y(h / 2) - 4)
  doc.text(clean(t('pdf.cushion.seamAllowance')), midX, Y(h / 2) + 6)
  doc.text(clean(t('pdf.cushion.sewLine', { top: f(tp), bottom: f(b), h: f(h) })), midX, Y(h / 2) + 16)
}

/** Wedge front view: finished length across, height up. */
function drawWedgeFront(doc: JsPDF, { t, font }: CushionPdfOptions, c: WorkOrderCushion, cuts: WedgeCuts, x0: number, y0: number, boxW: number, boxH: number) {
  doc.setFont(font, 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.cushion.frontView'), x0, y0)
  const sc = Math.min((boxW - 20) / cuts.finishedLength, (boxH - 18) / c.height)
  const w = cuts.finishedLength * sc
  const h = c.height * sc
  const x = x0 + (boxW - w) / 2
  const y = y0 + 18
  doc.setDrawColor(...INK)
  doc.setFillColor(241, 246, 251)
  doc.setLineWidth(1.2)
  doc.roundedRect(x, y, w, h, 3, 3, 'FD')
  dim(doc, font, x, y - 6, x + w, y - 6, t('pdf.cushion.dimL', { v: formatInches(cuts.finishedLength) }))
}

function dim(doc: JsPDF, font: string, x1: number, y1: number, x2: number, y2: number, label: string) {
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.6)
  doc.line(x1, y1, x2, y2)
  doc.line(x1, y1 - 3, x1, y1 + 3)
  doc.line(x2, y2 - 3, x2, y2 + 3)
  doc.setFont(font, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...INK)
  const mid = (x1 + x2) / 2
  const tw = doc.getTextWidth(clean(label)) + 6
  doc.setFillColor(255, 255, 255)
  doc.rect(mid - tw / 2, y1 - 6, tw, 10, 'F')
  doc.text(clean(label), mid, y1 + 3, { align: 'center' })
}
