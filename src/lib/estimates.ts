// Estimates (Admins only). Prices live in these tables; RLS lets only admins
// read or write them (owner decision 2026-10-15, replacing the July
// "no prices anywhere" rule for estimates only).
import { supabase } from './supabase'
import amLogo from '../assets/brands/AM.png'
import hovLogo from '../assets/brands/HOV.png'
import rhuLogo from '../assets/brands/RHU.png'

export type Store = 'AM' | 'HOV' | 'RHU'
export const STORES: Store[] = ['AM', 'HOV', 'RHU']

export type Business = {
  code: Store
  name: string
  address: string[]
  phone: string | null
  web: string
  email: string
  logo: string
  /** Logo width ÷ height, for laying it out without loading it first. */
  logoAspect: number
}

// From Eva, 2026-10-15 (brand-logos/businesses.md).
export const BUSINESSES: Record<Store, Business> = {
  AM: {
    code: 'AM',
    name: 'Alexander Matthews',
    address: ['9285 SW Greenburg Rd', 'Portland, OR 97223'],
    phone: '(503) 914-2948',
    web: 'alexandermatthews.com',
    email: 'info@alexandermatthews.com',
    logo: amLogo,
    logoAspect: 1200 / 316,
  },
  HOV: {
    code: 'HOV',
    name: 'House of Vonne',
    address: ['1512 SE 7th Ave', 'Portland, OR 97214'],
    phone: null,
    web: 'houseofvonne.com',
    email: 'hello@houseofvonne.com',
    logo: hovLogo,
    logoAspect: 391 / 431,
  },
  RHU: {
    code: 'RHU',
    name: 'Raleigh Hills Upholstery',
    address: ['5140 SW Beaverton Hillsdale Hwy', 'Portland, OR 97221'],
    phone: '(503) 245-8007',
    web: 'raleighhillsupholstery.com',
    email: 'info@raleighhillsupholstery.com',
    logo: rhuLogo,
    logoAspect: 1,
  },
}

export type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'declined'
export const ESTIMATE_STATUSES: EstimateStatus[] = ['draft', 'sent', 'accepted', 'declined']
export const STATUS_COLOR: Record<EstimateStatus, string> = {
  draft: 'default',
  sent: 'processing',
  accepted: 'success',
  declined: 'error',
}

export type Client = {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
}

export type EstimateLine = {
  id: string
  section: string | null
  name: string
  description: string | null
  quantity: number
  unit: string | null
  unit_price: number
  source: string | null
  /** Room / window group; null = not in a room. */
  group_id?: string | null
  /** The pricing tool's worksheet this line came from (null = typed in). */
  spec?: LineSpec | null
}

export type WorksheetTool = 'cushionPricing' | 'upholstery'
/** Every line sent from one tool session shares one worksheet; reopening it
 *  in the tool brings back all its inputs, and "Update" replaces its lines. */
export type LineSpec = { tool: WorksheetTool; version: 1; worksheet: string; input: unknown }

export const TOOL_ROUTES: Record<WorksheetTool, string> = {
  cushionPricing: '/tools/cushion-pricing',
  upholstery: '/tools/upholstery',
}

/** A room or window on the estimate, with its own subtotal. */
export type EstimateGroup = {
  id: string
  name: string
  /** "Client approved": only approved rooms count toward the deposit (and later become jobs). */
  approved: boolean
}

/** A line sent over from a pricing tool, before it belongs to an estimate. */
export type NewLine = Omit<EstimateLine, 'id'>

export type Estimate = {
  id: string
  store: Store
  number: number
  client_id: string | null
  title: string
  status: EstimateStatus
  estimate_date: string
  notes: string | null
  terms: string | null
  install_same: boolean
  install_name: string | null
  install_address: string | null
  deposit_pct: number
  created_at: string
  updated_at: string
}

export type EstimateSummary = Estimate & { client: Pick<Client, 'name' | 'company'> | null; total: number }
export type EstimateFull = Estimate & { client: Client | null; lines: EstimateLine[]; groups: EstimateGroup[] }

/** HOV10001 — the same shape as the job code the project will get. */
export const estimateCode = (e: { store: string; number: number }) => `${e.store}${e.number}`

/** Round to the cent, the same way the pricing tools show money. */
export const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const lineTotal = (l: Pick<EstimateLine, 'quantity' | 'unit_price'>) => cents((l.quantity || 0) * (l.unit_price || 0))
export const estimateTotal = (lines: Pick<EstimateLine, 'quantity' | 'unit_price'>[]) =>
  cents(lines.reduce((n, l) => n + lineTotal(l), 0))

/** Subtotal of each room, in room order, plus lines not in a room. */
export function groupTotals(groups: EstimateGroup[], lines: EstimateLine[]) {
  const ids = new Set(groups.map((g) => g.id))
  return {
    rooms: groups.map((g) => ({ group: g, total: estimateTotal(lines.filter((l) => l.group_id === g.id)) })),
    loose: estimateTotal(lines.filter((l) => !l.group_id || !ids.has(l.group_id))),
  }
}

/** Deposit on the approved rooms (and anything not in a room). */
export function depositAmount(groups: EstimateGroup[], lines: EstimateLine[], pct: number) {
  const { rooms, loose } = groupTotals(groups, lines)
  const base = loose + rooms.filter((r) => r.group.approved).reduce((n, r) => n + r.total, 0)
  return cents((base * (pct || 0)) / 100)
}

export const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Estimate Rocket template text → plain text for the client estimate. */
export function erToPlain(text: string): string {
  return text
    .split('\n')
    .filter((l) => l.trim() !== '____')
    .map((l) =>
      l
        .replace(/<\/?center>/g, '')
        .replace(/^_(.*)_$/, '$1')
        .replace(/^#+\s*/, '')
        .replace(/^\*\s+/, '• ')
        .replace(/\*\*/g, ''),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Readable text for any error. Database errors are plain objects, not Error
 *  instances, so String(e) would show "[object Object]". */
export function errorText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') return e.message
  return String(e)
}

function db() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function listEstimates(): Promise<EstimateSummary[]> {
  const { data, error } = await db()
    .from('estimates')
    .select('*, client:clients ( name, company ), lines:estimate_lines ( total )')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(({ lines, ...e }) => ({
    ...(e as unknown as Estimate),
    client: e.client,
    total: cents((lines ?? []).reduce((n: number, l: { total: number }) => n + Number(l.total), 0)),
  }))
}

export async function getEstimate(id: string): Promise<EstimateFull> {
  const { data, error } = await db()
    .from('estimates')
    .select('*, client:clients ( * ), lines:estimate_lines ( * ), groups:estimate_groups ( id, name, approved, position )')
    .eq('id', id)
    .order('position', { referencedTable: 'estimate_lines' })
    .order('position', { referencedTable: 'estimate_groups' })
    .single()
  if (error) throw error
  const e = data as unknown as EstimateFull
  return {
    ...e,
    deposit_pct: Number(e.deposit_pct ?? 50),
    groups: (e.groups ?? []).map(({ id, name, approved }) => ({ id, name, approved })),
    lines: e.lines.map((l) => ({ ...l, quantity: Number(l.quantity), unit_price: Number(l.unit_price) })),
  }
}

export async function createEstimate(
  fields: { store: Store; client_id: string | null; title: string; estimate_date?: string },
  lines: NewLine[],
): Promise<string> {
  const { data, error } = await db()
    .from('estimates')
    .insert(fields)
    .select('id')
    .single()
  if (error) throw error
  if (lines.length) await appendLines(data.id, lines)
  return data.id
}

export async function updateEstimate(
  id: string,
  patch: Partial<
    Pick<
      Estimate,
      'client_id' | 'title' | 'status' | 'estimate_date' | 'notes' | 'terms' | 'install_same' | 'install_name' | 'install_address' | 'deposit_pct'
    >
  >,
) {
  const { error } = await db().from('estimates').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteEstimate(id: string) {
  const { error } = await db().from('estimates').delete().eq('id', id)
  if (error) throw error
}

/** Only the columns the app writes. Lines read back from the database also
 *  carry `total` (calculated by the database) and `created_at`, which must not
 *  be sent back — the database refuses a write to `total`. */
function lineRow(l: NewLine & { id?: string }, estimateId: string, position: number) {
  return {
    ...(l.id ? { id: l.id } : {}),
    estimate_id: estimateId,
    position,
    section: l.section,
    name: l.name,
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unit_price: cents(l.unit_price),
    source: l.source,
    group_id: l.group_id ?? null,
    spec: (l.spec ?? null) as never,
  }
}

/** Adds lines after the estimate's existing ones. */
export async function appendLines(estimateId: string, lines: NewLine[]) {
  const { data: last } = await db()
    .from('estimate_lines')
    .select('position')
    .eq('estimate_id', estimateId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  const start = (last?.position ?? -1) + 1
  const { error } = await db()
    .from('estimate_lines')
    .insert(lines.map((l, i) => lineRow(l, estimateId, start + i)))
  if (error) throw error
}

/** Saves the full line list: removed lines are deleted, the rest upserted in order. */
export async function saveLines(estimateId: string, lines: EstimateLine[], removedIds: string[]) {
  if (removedIds.length) {
    const { error } = await db().from('estimate_lines').delete().in('id', removedIds)
    if (error) throw error
  }
  if (lines.length) {
    const { error } = await db()
      .from('estimate_lines')
      .upsert(lines.map((l, i) => lineRow(l, estimateId, i)))
    if (error) throw error
  }
}

/** Saves the rooms in order; removed rooms are deleted (their lines become "not in a room").
 *  Runs before saveLines so new rooms exist when lines point at them. */
export async function saveGroups(estimateId: string, groups: EstimateGroup[], removedIds: string[]) {
  if (groups.length) {
    const { error } = await db()
      .from('estimate_groups')
      .upsert(groups.map((g, i) => ({ id: g.id, estimate_id: estimateId, name: g.name, approved: g.approved, position: i })))
    if (error) throw error
  }
  if (removedIds.length) {
    const { error } = await db().from('estimate_groups').delete().in('id', removedIds)
    if (error) throw error
  }
}

/** Number and rooms of an estimate, for a tool that is adding to it. */
export async function getEstimateBrief(id: string) {
  const { data, error } = await db()
    .from('estimates')
    .select('id, store, number, status, groups:estimate_groups ( id, name )')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as unknown as { id: string; store: Store; number: number; status: EstimateStatus; groups: { id: string; name: string }[] }
}

/** The inputs of one worksheet on an estimate, and the room its lines are in. */
export async function getWorksheet(estimateId: string, worksheet: string) {
  const { data, error } = await db()
    .from('estimate_lines')
    .select('spec, group_id, position')
    .eq('estimate_id', estimateId)
    .eq('spec->>worksheet', worksheet)
    .order('position')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const spec = data.spec as unknown as LineSpec
  return { tool: spec.tool, input: spec.input, groupId: data.group_id }
}

/**
 * Sends a tool's lines to an estimate with their worksheet. A new worksheet is
 * added after the existing lines; an existing one replaces its old lines in
 * the same place on the estimate.
 */
export async function sendWorksheet(
  estimateId: string,
  tool: WorksheetTool,
  input: unknown,
  lines: NewLine[],
  opts: { worksheet?: string | null; groupId?: string | null } = {},
) {
  const worksheet = opts.worksheet ?? crypto.randomUUID()
  const tagged = lines.map((l) => ({ ...l, group_id: opts.groupId ?? null, spec: { tool, version: 1 as const, worksheet, input } }))
  if (!opts.worksheet) {
    await appendLines(estimateId, tagged)
    return worksheet
  }
  const { data: all, error } = await db()
    .from('estimate_lines')
    .select('id, position, spec')
    .eq('estimate_id', estimateId)
    .order('position')
  if (error) throw error
  const old = (all ?? []).filter((l) => (l.spec as { worksheet?: string } | null)?.worksheet === worksheet)
  const at = old.length ? (all ?? []).findIndex((l) => l.id === old[0].id) : (all ?? []).length
  const keep = (all ?? []).filter((l) => !old.some((o) => o.id === l.id))
  if (old.length) {
    const { error: delErr } = await db().from('estimate_lines').delete().in('id', old.map((o) => o.id))
    if (delErr) throw delErr
  }
  const fresh = tagged.map((l) => ({ ...l, id: crypto.randomUUID() }))
  const order = [...keep.slice(0, at).map((l) => l.id), ...fresh.map((l) => l.id), ...keep.slice(at).map((l) => l.id)]
  const { error: insErr } = await db()
    .from('estimate_lines')
    .insert(fresh.map((l) => lineRow(l, estimateId, order.indexOf(l.id))))
  if (insErr) throw insErr
  const moved = keep.map((l) => ({ id: l.id, estimate_id: estimateId, position: order.indexOf(l.id) }))
  if (moved.length) {
    const { error: posErr } = await db().from('estimate_lines').upsert(moved)
    if (posErr) throw posErr
  }
  return worksheet
}

export async function listDraftEstimates(): Promise<EstimateSummary[]> {
  return (await listEstimates()).filter((e) => e.status === 'draft')
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await db().from('clients').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function saveClient(c: Omit<Client, 'id'> & { id?: string }): Promise<Client> {
  const { data, error } = c.id
    ? await db().from('clients').update(c).eq('id', c.id).select('*').single()
    : await db().from('clients').insert(c).select('*').single()
  if (error) throw error
  return data
}

/** The next estimate number, shared by all three businesses (one counter row, store 'ALL'). */
export async function getNextNumber(): Promise<number | null> {
  const { data, error } = await db().from('estimate_counters').select('next_number').eq('store', 'ALL').maybeSingle()
  if (error) throw error
  return data?.next_number ?? null
}

export async function setNextNumber(next: number) {
  const { error } = await db().from('estimate_counters').update({ next_number: next }).eq('store', 'ALL')
  if (error) throw error
}
