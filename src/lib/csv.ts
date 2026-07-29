/** Labor CSV export (SPEC §15). Kept dependency-free so it can be unit-tested
 *  outside the app. Excel quirk: the file must start with a UTF-8 BOM or
 *  Cyrillic names render as mojibake. */

export type LaborCsvRow = {
  date: string // YYYY-MM-DD
  work_order: string
  job_code: string
  job_name: string
  department: string
  task: string
  user: string
  clock_in: string // HH:MM
  clock_out: string // HH:MM, '' while active
  duration_minutes: number
  flagged: boolean // admin_override / auto clock-out
}

export const LABOR_CSV_COLUMNS = [
  'date', 'work_order', 'job_code', 'job_name', 'department', 'task',
  'user', 'clock_in', 'clock_out', 'duration_minutes', 'flagged',
] as const

function esc(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function laborCsv(rows: LaborCsvRow[]): string {
  const lines = [LABOR_CSV_COLUMNS.join(',')]
  for (const r of rows) {
    lines.push(
      LABOR_CSV_COLUMNS.map((c) =>
        c === 'flagged' ? (r.flagged ? 'TRUE' : 'FALSE') : esc(r[c]),
      ).join(','),
    )
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
