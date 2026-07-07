/**
 * Pick the viewer's language from a stored translation blob ({ en, ru, es }),
 * falling back to the original canonical text when a translation is missing.
 */
export function localized(original: string, i18n: unknown, lang: string): string {
  if (i18n && typeof i18n === 'object') {
    const v = (i18n as Record<string, unknown>)[lang]
    if (typeof v === 'string' && v.trim()) return v
  }
  return original
}
