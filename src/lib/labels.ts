import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export type LabelJob = {
  job_code: string
  name: string
  qr_code_uuid: string
}

type LabelItem = {
  /** Big bold text (job code or material qty). Auto-shrunk to fit. */
  code: string
  /** Wrapping name line(s). */
  name: string
  /** Small gray bottom line (client / job code). */
  sub: string
  /** Deep-link URL encoded in the QR. */
  url: string
}

/** Deep link a QR code points at — opens the app straight to the job. */
export function jobDeepLink(qrUuid: string): string {
  return `${window.location.origin}/j/${qrUuid}`
}

/** Deep link for a material component tag — opens the job's Materials tab. */
export function materialDeepLink(jobQrUuid: string, materialQrUuid: string): string {
  return `${window.location.origin}/j/${jobQrUuid}/m/${materialQrUuid}`
}

/**
 * Print-ready PDF of 2.25" × 1.25" thermal labels, one per item: QR left,
 * big code + name + sub-line right. Opens the browser print dialog.
 */
async function printLabels(items: LabelItem[]): Promise<void> {
  const W = 2.25
  const H = 1.25
  const doc = new jsPDF({ unit: 'in', format: [W, H], orientation: 'landscape' })

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (i > 0) doc.addPage([W, H], 'landscape')

    const qrDataUrl = await QRCode.toDataURL(item.url, { margin: 0, width: 200 })

    // QR on the left.
    const qrSize = 0.95
    doc.addImage(qrDataUrl, 'PNG', 0.08, (H - qrSize) / 2, qrSize, qrSize)

    // Text on the right.
    const textX = 1.12
    const textW = W - textX - 0.08 // available width (inches)

    // Code line, auto-shrunk so long codes fit the label width.
    doc.setFont('helvetica', 'bold')
    let codeSize = 15
    doc.setFontSize(codeSize)
    const codeWidth = doc.getTextWidth(item.code)
    if (codeWidth > textW) {
      codeSize = Math.max(9, Math.floor(codeSize * (textW / codeWidth)))
      doc.setFontSize(codeSize)
    }
    doc.text(item.code, textX, 0.36)

    // Name (wraps; capped at two lines).
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text(doc.splitTextToSize(item.name, textW).slice(0, 2), textX, 0.6)

    // Sub-line (bottom).
    doc.setFontSize(7)
    doc.setTextColor(110)
    doc.text(doc.splitTextToSize(item.sub, textW).slice(0, 1), textX, H - 0.18)
    doc.setTextColor(0)
  }

  doc.autoPrint()
  const url = doc.output('bloburl')
  window.open(url, '_blank')
}

/** Job labels (single or whole-project batch). */
export async function printJobLabels(jobs: LabelJob[], clientName: string): Promise<void> {
  await printLabels(
    jobs.map((j) => ({
      code: j.job_code,
      name: j.name,
      sub: clientName,
      url: jobDeepLink(j.qr_code_uuid),
    })),
  )
}

/** Component tag for one material: job code big, material name, qty below. */
export async function printMaterialLabel(params: {
  jobCode: string
  jobQrUuid: string
  materialName: string
  materialQrUuid: string
  qtyLine: string
}): Promise<void> {
  await printLabels([
    {
      code: params.jobCode,
      name: params.materialName,
      sub: params.qtyLine,
      url: materialDeepLink(params.jobQrUuid, params.materialQrUuid),
    },
  ])
}
