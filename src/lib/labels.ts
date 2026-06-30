import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

export type LabelJob = {
  job_code: string
  name: string
  qr_code_uuid: string
}

/** Deep link a QR code points at — opens the app straight to the job. */
export function jobDeepLink(qrUuid: string): string {
  return `${window.location.origin}/j/${qrUuid}`
}

/**
 * Build a print-ready PDF of 2.25" × 1.25" thermal labels — one per job — each
 * with the QR code, the job code (large), the job name, and the client.
 * Opens the browser print dialog (sized to the label, for a thermal printer).
 */
export async function printJobLabels(jobs: LabelJob[], clientName: string): Promise<void> {
  const W = 2.25
  const H = 1.25
  const doc = new jsPDF({ unit: 'in', format: [W, H], orientation: 'landscape' })

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    if (i > 0) doc.addPage([W, H], 'landscape')

    const qrDataUrl = await QRCode.toDataURL(jobDeepLink(job.qr_code_uuid), {
      margin: 0,
      width: 200,
    })

    // QR on the left.
    const qrSize = 0.95
    doc.addImage(qrDataUrl, 'PNG', 0.08, (H - qrSize) / 2, qrSize, qrSize)

    // Text on the right.
    const textX = 1.12
    const textW = W - textX - 0.08 // available width (inches)

    // Job code, auto-shrunk so even long codes fit the label width.
    doc.setFont('helvetica', 'bold')
    let codeSize = 15
    doc.setFontSize(codeSize)
    const codeWidth = doc.getTextWidth(job.job_code)
    if (codeWidth > textW) {
      codeSize = Math.max(9, Math.floor(codeSize * (textW / codeWidth)))
      doc.setFontSize(codeSize)
    }
    doc.text(job.job_code, textX, 0.36)

    // Job name (wraps; capped at two lines).
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const nameLines = doc.splitTextToSize(job.name, textW).slice(0, 2)
    doc.text(nameLines, textX, 0.6)

    // Client (bottom).
    doc.setFontSize(7)
    doc.setTextColor(110)
    doc.text(doc.splitTextToSize(clientName, textW).slice(0, 1), textX, H - 0.18)
    doc.setTextColor(0)
  }

  doc.autoPrint()
  const url = doc.output('bloburl')
  window.open(url, '_blank')
}
