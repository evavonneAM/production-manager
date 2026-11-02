import type { jsPDF as JsPDF } from 'jspdf'
import { formatInches as f } from './inches'
import { type LeafBagCuts } from './leafBag'
import { pdfFont, pdfLanguage, type PdfT } from '../pdfText'

export type LeafBagLine = {
  job: string
  leafWidth: number | null
  leafDepth: number | null
  bagWidth: number
  bagDepth: number
  cuts: LeafBagCuts
}

/** The PDF's language and font. */
export type LeafBagPdfOptions = { t: PdfT; lng: string; font: string }

// Letter, points.
const PW = 612
const PH = 792
const M = 40
const CW = PW - 2 * M
const INK: [number, number, number] = [20, 24, 31]
const MUTED: [number, number, number] = [96, 104, 116]
const RULE: [number, number, number] = [210, 214, 220]
const HEADER: [number, number, number] = [0, 21, 41]

const clean = (s: string) => s.replace(/[″”“]/g, '"').replace(/[−–—]/g, '-').replace(/×/g, 'x')
const dateText = (lng: string) => new Date().toLocaleDateString(lng, { year: 'numeric', month: 'long', day: 'numeric' })
const fileSafe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-')

/** Cut list work order: summary table, panel diagram, assembly steps. */
export async function downloadLeafBagWorkOrder(lines: LeafBagLine[]): Promise<void> {
  const [{ jsPDF }, diagram] = await Promise.all([import('jspdf'), loadDiagram()])
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const font = await pdfFont(doc)
  const { t, lng } = pdfLanguage()
  buildLeafBagWorkOrder(doc, lines, diagram, { t, lng, font }).save(fileSafe(`${t('pdf.leafBag.fileCutList', { date: new Date().toISOString().slice(0, 10) })}.pdf`))
}

/** Labels: 3 per bag line (Finished, Long Bottom, Short Top) on a 30-up sheet. */
export async function downloadLeafBagLabels(lines: LeafBagLine[]): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const font = await pdfFont(doc)
  const { t, lng } = pdfLanguage()
  buildLeafBagLabels(doc, lines, { t, lng, font }).save(fileSafe(`${t('pdf.leafBag.fileLabels', { date: new Date().toISOString().slice(0, 10) })}.pdf`))
}

/** The workroom's panel drawing (same one the old calculator printed). */
async function loadDiagram(): Promise<Uint8Array> {
  const url = (await import('../../assets/leaf-bag-panels.png')).default
  return new Uint8Array(await (await fetch(url)).arrayBuffer())
}

// Source drawing is 2048 x 965 px.
const DIAGRAM_RATIO = 965 / 2048

export function buildLeafBagWorkOrder(doc: JsPDF, lines: LeafBagLine[], diagram: Uint8Array, { t, lng, font }: LeafBagPdfOptions): JsPDF {
  let y = 0
  const header = (first: boolean) => {
    doc.setFillColor(...HEADER)
    doc.rect(0, 0, PW, first ? 64 : 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(font, 'bold')
    doc.setFontSize(first ? 18 : 11)
    doc.text(t('pdf.leafBag.title'), M, first ? 32 : 22)
    doc.setFont(font, 'normal')
    doc.setFontSize(10)
    if (first) {
      const bags = lines.reduce((n, l) => n + l.cuts.qty, 0)
      doc.text(`${t('pdf.leafBag.jobs', { count: lines.length })}  |  ${t('pdf.leafBag.bags', { count: bags })}`, M, 50)
    }
    doc.text(dateText(lng), PW - M, first ? 32 : 22, { align: 'right' })
    y = first ? 92 : 60
  }
  header(true)

  // Cut table.
  const cols = [
    { k: t('pdf.leafBag.colJob'), x: 0, w: 0.2 },
    { k: t('pdf.leafBag.colQty'), x: 0.2, w: 0.08 },
    { k: t('pdf.leafBag.colFinished'), x: 0.28, w: 0.24 },
    { k: t('pdf.leafBag.colLongBottom'), x: 0.52, w: 0.24 },
    { k: t('pdf.leafBag.colShortTop'), x: 0.76, w: 0.24 },
  ].map((c) => ({ ...c, x: M + c.x * CW, w: c.w * CW }))
  const tableHead = () => {
    doc.setFillColor(...HEADER)
    doc.rect(M, y - 12, CW, 18, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont(font, 'bold')
    doc.setFontSize(8)
    cols.forEach((c) => doc.text(c.k, c.x + 6, y))
    y += 8
  }
  tableHead()
  lines.forEach((l, i) => {
    if (y + 26 > PH - M) {
      doc.addPage()
      header(false)
      tableHead()
    }
    if (i % 2 === 1) {
      doc.setFillColor(244, 246, 249)
      doc.rect(M, y, CW, 24, 'F')
    }
    doc.setTextColor(...INK)
    doc.setFont(font, 'bold')
    doc.setFontSize(11)
    const vals = [
      l.job || '-',
      String(l.cuts.qty),
      `${f(l.bagWidth)} x ${f(l.bagDepth)}`,
      `${f(l.cuts.longBottom.width)} x ${f(l.cuts.longBottom.length)}`,
      `${f(l.cuts.shortTop.width)} x ${f(l.cuts.shortTop.length)}`,
    ]
    vals.forEach((v, k) => {
      doc.setFont(font, k === 2 ? 'normal' : 'bold')
      doc.text(clean(v), cols[k].x + 6, y + 16)
    })
    y += 24
  })
  doc.setDrawColor(...RULE)
  doc.line(M, y, M + CW, y)
  y += 12
  doc.setFont(font, 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...MUTED)
  doc.text(t('pdf.leafBag.rule'), M, y + 4)
  y += 22

  // Panel diagram + assembly on their own page if they don't fit.
  const dh = CW * DIAGRAM_RATIO
  if (y + dh + 190 > PH - M) {
    doc.addPage()
    header(false)
  }
  section(doc, font, t('pdf.leafBag.panelDiagram'), y)
  y += 12
  doc.addImage(diagram, 'PNG', M, y, CW, dh, 'leaf-bag-panels', 'FAST')
  y += dh + 18
  section(doc, font, t('pdf.leafBag.assembly'), y)
  y += 18
  doc.setFont(font, 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(...INK)
  const steps = [
    t('pdf.leafBag.step1'),
    t('pdf.leafBag.step2'),
    t('pdf.leafBag.step3'),
    t('pdf.leafBag.step4'),
    t('pdf.leafBag.step5'),
    t('pdf.leafBag.step6'),
    t('pdf.leafBag.step7'),
    t('pdf.leafBag.step8'),
  ]
  steps.forEach((s, i) => {
    doc.setFont(font, 'bold')
    doc.text(`${i + 1}.`, M + 4, y)
    doc.setFont(font, 'normal')
    doc.text(clean(s), M + 22, y)
    y += 16
  })

  pageNumbers(doc, t, font)
  return doc
}

function section(doc: JsPDF, font: string, title: string, y: number) {
  doc.setFont(font, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...INK)
  doc.text(title, M, y)
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.8)
  doc.line(M, y + 4, M + CW, y + 4)
}

export function buildLeafBagLabels(doc: JsPDF, lines: LeafBagLine[], { t, font }: LeafBagPdfOptions): JsPDF {
  // 30-up address-label sheet (2 5/8" x 1"): 3 across, 10 down — one row per bag line.
  const LW = 189
  const LH = 72
  const left = 13.5
  const top = 36
  const gap = 9
  let row = 0
  lines.forEach((l) => {
    if (row === 10) {
      doc.addPage()
      row = 0
    }
    const items: [string, string][] = [
      [t('pdf.leafBag.labelFinished'), `${f(l.bagWidth)} x ${f(l.bagDepth)}`],
      [t('pdf.leafBag.labelLongBottom'), `${f(l.cuts.longBottom.width)} x ${f(l.cuts.longBottom.length)}`],
      [t('pdf.leafBag.labelShortTop'), `${f(l.cuts.shortTop.width)} x ${f(l.cuts.shortTop.length)}`],
    ]
    items.forEach(([piece, dims], col) => {
      const x = left + col * (LW + gap) + 10
      const yy = top + row * LH
      doc.setTextColor(...INK)
      doc.setFont(font, 'bold')
      doc.setFontSize(11)
      doc.text(clean(l.job || '-'), x, yy + 20)
      doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text(`${piece}${l.cuts.qty > 1 ? `  ${t('pdf.leafBag.labelQty', { n: l.cuts.qty })}` : ''}`, x, yy + 33)
      doc.setTextColor(...INK)
      doc.setFontSize(14)
      doc.text(clean(dims), x, yy + 52)
    })
    row++
  })
  return doc
}

function pageNumbers(doc: JsPDF, t: PdfT, font: string) {
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(font, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(t('pdf.common.page', { n: p, total: pages }), PW - M, PH - 20, { align: 'right' })
  }
}
