// Shared by the tool PDFs: a font that has Cyrillic (jsPDF's built-in Helvetica does not),
// and the app's translations, so each PDF prints in the language the person uses the app in.
import type { jsPDF as JsPDF } from 'jspdf'
import i18n from '../i18n'

/** Looks up a translation; `opts` fills {{placeholders}} and picks plural forms (count). */
export type PdfT = (key: string, opts?: Record<string, unknown>) => string

/** The person's language and a translator fixed to it, for one PDF. */
export function pdfLanguage(): { t: PdfT; lng: string } {
  const lng = i18n.resolvedLanguage ?? i18n.language ?? 'en'
  const fixed = i18n.getFixedT(lng)
  return { t: (key, opts) => String(fixed(key, opts)), lng }
}

export const PDF_FONT = 'NotoSans'

let fonts: Promise<[string, string]> | null = null

const base64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Noto Sans regular + bold (Latin and Cyrillic, ~60 KB each), fetched once when a PDF is made. */
function loadFonts(): Promise<[string, string]> {
  const get = async (name: string) => base64(await (await fetch(`/fonts/${name}`)).arrayBuffer())
  fonts ??= Promise.all([get('NotoSans-Regular.ttf'), get('NotoSans-Bold.ttf')]).catch((e) => {
    fonts = null
    throw e
  })
  return fonts
}

/**
 * Registers Noto Sans on the document and returns the font name to use. If the font can't be
 * loaded (offline before it was cached), falls back to Helvetica: English and Spanish still
 * print, Russian letters won't.
 */
export async function pdfFont(doc: JsPDF): Promise<string> {
  try {
    const [regular, bold] = await loadFonts()
    doc.addFileToVFS('NotoSans-Regular.ttf', regular)
    doc.addFont('NotoSans-Regular.ttf', PDF_FONT, 'normal')
    doc.addFileToVFS('NotoSans-Bold.ttf', bold)
    doc.addFont('NotoSans-Bold.ttf', PDF_FONT, 'bold')
    return PDF_FONT
  } catch {
    return 'helvetica'
  }
}
