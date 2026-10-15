import type { jsPDF as JsPDF } from 'jspdf'
import { formatInches as f } from './inches'
import { KERF, SHEET_L, SHEET_PRICE, SHEET_W, TRIM, type PlywoodPlan } from './plywoodNesting'

// Letter, points. English only: jsPDF's built-in font has no Cyrillic.
const PW = 612
const PH = 792
const M = 40
const CW = PW - 2 * M
const INK: [number, number, number] = [20, 24, 31]
const MUTED: [number, number, number] = [96, 104, 116]
const HEADER: [number, number, number] = [0, 21, 41]
const SCRAP: [number, number, number] = [236, 238, 242]
const PART: [number, number, number] = [212, 227, 242]
const EDGE: [number, number, number] = [22, 119, 255]
const WARN: [number, number, number] = [168, 50, 31]

const clean = (s: string) => s.replace(/[″”“]/g, '"').replace(/[−–—]/g, '-').replace(/×/g, 'x')
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export async function downloadPlywoodPdf(plan: PlywoodPlan): Promise<void> {
  const { jsPDF } = await import('jspdf')
  buildPlywoodPdf(new jsPDF({ unit: 'pt', format: 'letter' }), plan).save('Plywood cutting layout.pdf')
}

export function buildPlywoodPdf(doc: JsPDF, plan: PlywoodPlan): JsPDF {
  const header = () => {
    doc.setFillColor(...HEADER)
    doc.rect(0, 0, PW, 56, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Plywood Cutting Layout', M, 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(new Date().toLocaleDateString('en-US'), PW - M, 34, { align: 'right' })
  }
  header()

  let y = 84
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(`${plan.sheets.length} sheet${plan.sheets.length === 1 ? '' : 's'} of 4 x 8 plywood  -  ${money(plan.cost)}`, M, y)
  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...MUTED)
  doc.text(
    clean(`${plan.pieces} pieces at ${money(SHEET_PRICE)} a sheet. Allows ${f(KERF)} saw kerf and ${f(TRIM)} trim on each factory edge. Every piece is whole on one sheet.`),
    M,
    y,
  )
  y += 18

  if (plan.tooBig.length) {
    doc.setTextColor(...WARN)
    doc.setFont('helvetica', 'bold')
    doc.text('Not counted - bigger than a sheet. Confirm seat breaks with the client:', M, y)
    doc.setFont('helvetica', 'normal')
    y += 13
    for (const x of plan.tooBig) {
      doc.text(clean(`- ${x.name}: ${f(x.length)} x ${f(x.depth)}`), M + 8, y)
      y += 12
    }
    y += 8
  }

  // Sheets: 3 across, as tall as fits.
  const cols = 3
  const gap = 18
  const cellW = (CW - gap * (cols - 1)) / cols
  const scale = (cellW - 20) / SHEET_W
  const drawH = SHEET_L * scale
  plan.sheets.forEach((sheet, i) => {
    const col = i % cols
    const lines = sheet.pieces.length
    const cellH = 14 + drawH + 8 + lines * 10 + 14
    if (col === 0 && y + cellH > PH - M) {
      doc.addPage()
      header()
      y = 84
    }
    const x0 = M + col * (cellW + gap)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(`Sheet ${i + 1} of ${plan.sheets.length}`, x0, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MUTED)
    doc.text(`${Math.round(sheet.used * 100)}% used`, x0 + cellW, y, { align: 'right' })
    const sx = x0 + (cellW - SHEET_W * scale) / 2
    const sy = y + 8
    doc.setFillColor(...SCRAP)
    doc.setDrawColor(85, 85, 85)
    doc.setLineWidth(0.6)
    doc.rect(sx, sy, SHEET_W * scale, drawH, 'FD')
    sheet.pieces.forEach((p, k) => {
      const px = sx + p.x * scale
      const py = sy + p.y * scale
      doc.setFillColor(...PART)
      doc.setDrawColor(...EDGE)
      doc.rect(px, py, p.w * scale, p.h * scale, 'FD')
      doc.setTextColor(...INK)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      const label = clean(`${k + 1}. ${f(Math.max(p.w, p.h))} x ${f(Math.min(p.w, p.h))}`)
      const cx = px + (p.w * scale) / 2
      const cy = py + (p.h * scale) / 2
      if (p.h > p.w) doc.text(label, cx + 3, cy, { align: 'center', angle: 90 })
      else doc.text(label, cx, cy + 3, { align: 'center' })
    })
    let ly = sy + drawH + 14
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    sheet.pieces.forEach((p, k) => {
      const t = clean(`${k + 1}. ${p.name}`)
      doc.text(doc.splitTextToSize(t, cellW)[0] as string, x0, ly)
      ly += 10
    })
    if (col === cols - 1 || i === plan.sheets.length - 1) {
      const rowStart = i - col
      const tallest = Math.max(...plan.sheets.slice(rowStart, i + 1).map((s) => s.pieces.length))
      y += 14 + drawH + 8 + tallest * 10 + 18
    }
  })

  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Sizes are the finished board size. Grain direction is not locked.', M, PH - 20)
    doc.text(`Page ${p} of ${pages}`, PW - M, PH - 20, { align: 'right' })
  }
  return doc
}
