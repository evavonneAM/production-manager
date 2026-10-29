// Vendor order emails (owner, 2026-10-29): some vendors take orders by email.
// Inserts go as a table like the workroom's Nom de Plume orders (sidemark,
// qty, dimensions, notes, blend, type, supplier); everything else as a
// bulleted list under category headings. Always English: it goes to vendors.

type Specs = { direction?: string; insertType?: string; blend?: string; foamType?: string; dimensions?: string; notes?: string }

export type OrderLine = {
  name: string
  quantity: number
  unit: string | null
  category: string
  supplier: string | null
  description: string | null
  specs: unknown
  job: { job_code: string; project: { client_name: string } | null } | null
}

const HEADINGS: Record<string, string> = {
  fabric: 'Fabric',
  com: 'Fabric',
  insert: 'Inserts',
  foam: 'Foam',
  upholstery_supplies: 'Upholstery Supplies',
  drapery_supplies: 'Drapery Supplies',
  drapery_hardware: 'Drapery Hardware',
  hardware: 'Components',
  other: 'Components',
  wood_shop: 'Wood',
}

// Inline styles so the preview (Tailwind resets tags) and Gmail paste agree.
const P = 'style="margin:0 0 12px"'
const H3 = 'style="margin:16px 0 6px;font-size:15px;font-weight:bold"'
const UL = 'style="margin:0 0 12px;padding-left:22px;list-style:disc"'
const LI = 'style="margin:4px 0"'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const qty = (n: number) => String(Math.round(n * 100) / 100)

function bullet(l: OrderLine): string {
  const specs = (l.specs ?? {}) as Specs
  const amount = `${qty(l.quantity)}${l.unit ? ` ${l.unit}` : ''}`
  const extra = [specs.dimensions, specs.direction, specs.notes].filter(Boolean).join(', ')
  return `${l.name}${extra ? ` (${extra})` : ''} — ${amount}`
}

export function buildOrderEmail(lines: OrderLine[], greetName = ''): { html: string; text: string } {
  const inserts = lines.filter((l) => l.category === 'insert')
  const rest = lines.filter((l) => l.category !== 'insert')
  const groups = new Map<string, OrderLine[]>()
  for (const l of rest) {
    const h = HEADINGS[l.category] ?? 'Other'
    groups.set(h, [...(groups.get(h) ?? []), l])
  }
  const showHeadings = groups.size > 1 || inserts.length > 0

  const hi = `Hi${greetName ? ` ${greetName}` : ''},`
  const ask = 'Can we please order the following:'
  const html: string[] = [`<p ${P}>${esc(hi)}</p>`, `<p ${P}>${esc(ask)}</p>`]
  const text: string[] = [hi, '', ask, '']

  if (inserts.length) {
    const cols = ['SIDEMARK', 'QTY', 'DIMENSIONS', 'NOTES', 'BLEND', 'TYPE', 'SUPPLIER']
    const rows = inserts.map((l) => {
      const s = (l.specs ?? {}) as Specs
      return [l.job?.project?.client_name ?? '', qty(l.quantity), s.dimensions ?? '', s.notes ?? '', s.blend ?? '', s.insertType ?? '', l.supplier ?? '']
    })
    const th = 'style="background:#b6d7a8;border:1px solid #999;padding:4px 10px;font-family:serif"'
    const td = 'style="border:1px solid #999;padding:4px 10px;text-align:center;font-family:serif"'
    const qtd = 'style="border:1px solid #999;padding:4px 10px;text-align:center;font-family:serif;background:#ffff66"'
    if (showHeadings && groups.size) html.push(`<h3 ${H3}>Inserts</h3>`)
    html.push(
      `<table style="border-collapse:collapse"><tr>${cols.map((c) => `<th ${c === 'QTY' ? th.replace('#b6d7a8', '#ffff66') : th}>${c}</th>`).join('')}</tr>` +
        rows.map((r) => `<tr>${r.map((v, i) => `<td ${i === 1 ? qtd : td}>${esc(v)}</td>`).join('')}</tr>`).join('') +
        '</table><br>',
    )
    if (showHeadings && groups.size) text.push('Inserts')
    text.push(cols.join(' | '))
    for (const r of rows) text.push(r.join(' | '))
    text.push('')
  }

  for (const [heading, items] of groups) {
    if (showHeadings) {
      html.push(`<h3 ${H3}>${esc(heading)}</h3>`)
      text.push(heading)
    }
    html.push(`<ul ${UL}>${items.map((l) => `<li ${LI}>${esc(bullet(l))}</li>`).join('')}</ul>`)
    for (const l of items) text.push(`• ${bullet(l)}`)
    text.push('')
  }

  html.push(`<p ${P}>Thank you,</p>`)
  text.push('Thank you,')
  return { html: html.join('\n'), text: text.join('\n') }
}

/** Copy as rich text (tables paste into Gmail) with a plain-text fallback. */
export async function copyOrderEmail(email: { html: string; text: string }): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([email.html], { type: 'text/html' }),
          'text/plain': new Blob([email.text], { type: 'text/plain' }),
        }),
      ])
    } else {
      await navigator.clipboard.writeText(email.text)
    }
    return true
  } catch {
    try {
      await navigator.clipboard.writeText(email.text)
      return true
    } catch {
      return false
    }
  }
}
