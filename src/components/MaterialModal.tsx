import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createMaterial, updateMaterial, type MaterialCategory } from '../lib/data'
import type { Material } from '../lib/types'

// Vendor/option catalogs straight from the owner's sketches (2026-07-28).
// Catalog values are canonical English (product terms), like job codes.
const FABRIC_DIRECTIONS = ['Railroaded', 'Up the roll', 'Any', 'Other']
const FABRIC_UNITS = ['yd', 'sqft']
const INSERT_VENDORS = ['Nom de Plume', 'Ronco', 'Rex Pegg', 'Miami Corp', 'Perfect Fit', 'Keystone', 'Flexco', 'Amazon', 'Other']
const INSERT_TYPES = ['Seat', 'Back', 'Pillow Insert', 'Ottoman', 'Other']
const INSERT_BLENDS = [
  'Solid - Celeste Fiber',
  'Solid - 25/75 WG Down/Feather Blend',
  'Solid - 50/50 WG Down/Feather Blend',
  'Solid - Celeste Fiber with BIO TICK',
  'Envelope - Celeste Fiber',
  'Envelope - 25/75 WG Down/Feather Blend',
  'Envelope - 50/50 WG Down/Feather Blend',
  'Envelope - Celeste Fiber with BIO TICK',
  'Solid Blown Fiber',
  '1818 HDR Foam', '2521 HDR Foam', '2528 HDR Foam', '2535 HDR Foam',
  '2550 HDR Foam', '2570 HDR Foam', '2740 HDR Foam',
  'Spring Core Unit',
  'Other',
]
const FOAM_VENDORS = ['Use Inventory', 'Rex Pegg', 'Perfect Fit', 'Other']
const FOAM_TYPES = [
  'Soft HDR Foam', 'Medium HDR Foam', 'Medium Firm HDR Foam', 'Firm HDR Foam', 'Xtra Firm HDR Foam',
  '1818 HDR Foam', '2521 HDR Foam', '2528 HDR Foam', '2535 HDR Foam', '2550 HDR Foam', '2570 HDR Foam', '2740 HDR Foam', 'Other',
]
const HARDWARE_VENDORS = [
  'Use Inventory', 'COM', 'Rex Pegg', 'Perfect Fit', 'Forest Drapery Hardware', 'Iron Art by Orion',
  'Rejuvenation', 'Ronco', 'Miami Corp', 'Keystone', 'Flexco', 'Amazon', 'Trivantage',
  'Rowely Drapery Hardware', 'Alan Richard Textiles', 'Other',
]

type Specs = {
  direction?: string
  insertType?: string
  blend?: string
  foamType?: string
  dimensions?: string
  customOrder?: boolean
  notes?: string
}

/**
 * Add (material == null) or edit a material. Each category renders the form
 * from the owner's sketch; structured picks live in `specs` and are also
 * composed into the description so lists and the Google Sheet stay readable.
 * "Use Inventory" vendors skip the ordering flow (created already arrived).
 */
export function MaterialModal({
  jobId,
  material,
  category: initialCategory,
  onClose,
  onSaved,
}: {
  jobId: string
  material: Material | null
  category: MaterialCategory
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const editCategory = (material?.category as MaterialCategory) ?? initialCategory
  // The fabric form covers both 'fabric' and 'com' (checkbox decides which).
  const formKind: MaterialCategory = editCategory === 'com' ? 'fabric' : editCategory
  const prior = (material?.specs ?? {}) as Specs

  const [name, setName] = useState(material?.name ?? '')
  const [isCom, setIsCom] = useState(editCategory === 'com')
  const [quantity, setQuantity] = useState(material ? String(material.quantity) : '1')
  const [unit, setUnit] = useState(material?.unit ?? (formKind === 'fabric' ? 'yd' : 'pcs'))
  const [supplier, setSupplier] = useState(material?.supplier ?? '')
  const [paymentRequired, setPaymentRequired] = useState(material?.payment_required ?? false)
  const [direction, setDirection] = useState(prior.direction ?? '')
  const [insertType, setInsertType] = useState(prior.insertType ?? '')
  const [blend, setBlend] = useState(prior.blend ?? '')
  const [foamType, setFoamType] = useState(prior.foamType ?? '')
  const [dimensions, setDimensions] = useState(prior.dimensions ?? '')
  const [customOrder, setCustomOrder] = useState(prior.customOrder ?? false)
  const [notes, setNotes] = useState(prior.notes ?? (formKind === 'other' ? material?.description ?? '' : ''))
  const [productUrl, setProductUrl] = useState(material?.product_url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Owner refinement: inserts/foam get a typed "Item name" (multiple cushion
  // sizes per project need distinct names); when left blank we derive one.
  const derivedName = (): string => {
    if (name.trim()) return name.trim()
    if (formKind === 'insert' && insertType)
      return insertType === 'Pillow Insert' ? 'Pillow insert' : insertType === 'Other' ? 'Insert' : `${insertType} insert`
    if (formKind === 'foam' && foamType) return foamType === 'Other' ? 'Foam' : foamType
    return ''
  }

  const composedDescription = (): string | null => {
    const parts: (string | false | undefined)[] =
      formKind === 'fabric' ? [direction && `${t('materials.direction')}: ${direction}`, notes]
      : formKind === 'insert' ? [blend, dimensions && `${t('materials.dimensions')}: ${dimensions}`, notes]
      : formKind === 'foam' ? [dimensions && `${t('materials.dimensions')}: ${dimensions}`, customOrder && t('materials.wedgeCustom'), notes]
      : formKind === 'hardware' ? [notes, customOrder && t('materials.customOrder')]
      : [notes]
    const text = parts.filter(Boolean).join(' · ')
    return text || null
  }

  const finalName = derivedName()
  const canSave = !!finalName && !!quantity

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    setBusy(true)
    setError(null)
    const category: MaterialCategory = formKind === 'fabric' ? (isCom ? 'com' : 'fabric') : formKind
    const specs: Specs = {
      ...(direction ? { direction } : {}),
      ...(insertType ? { insertType } : {}),
      ...(blend ? { blend } : {}),
      ...(foamType ? { foamType } : {}),
      ...(dimensions.trim() ? { dimensions: dimensions.trim() } : {}),
      ...(customOrder ? { customOrder } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }
    const fromStock = supplier === 'Use Inventory'
    const shared = {
      quantity: Number(quantity),
      unit: unit.trim() || null,
      supplier: supplier.trim() || null,
      description: composedDescription(),
      category,
      payment_required: paymentRequired,
      specs,
      product_url: productUrl.trim() || null,
    }
    const result = material
      ? await updateMaterial(material.id, {
          ...(finalName !== material.name ? { name: finalName } : {}),
          ...shared,
        })
      : await createMaterial({ jobId, name: finalName, ...shared, fromStock })
    setBusy(false)
    if (result.error) setError(t('common.error'))
    else onSaved()
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none'

  // Catalog values stay canonical English; only the special entries translate.
  const optLabel = (v: string) =>
    v === 'Use Inventory' ? t('materials.useInventory') : v === 'Other' ? t('materials.otherOption') : v

  const vendorSelect = (options: string[]) => (
    <label className="text-sm text-slate-300">
      {t('materials.vendor')}
      <select value={supplier} onChange={(e) => setSupplier(e.target.value)} required className={`mt-1 ${field}`}>
        <option value="">—</option>
        {options.map((v) => (
          <option key={v} value={v}>{optLabel(v)}</option>
        ))}
      </select>
    </label>
  )

  const itemNameField = (
    <label className="text-sm text-slate-300">
      {t('materials.itemName')}
      <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} placeholder={t('materials.itemNamePlaceholder')} />
    </label>
  )

  const checkbox = (checked: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex items-center gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)}
        className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-amber-600" />
      {label}
    </label>
  )

  const qtyField = (
    <label className="w-24 shrink-0 text-sm text-slate-300">
      {t('materials.qty')}
      <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={`mt-1 ${field}`} />
    </label>
  )

  const dimensionsField = (
    <label className="flex-1 text-sm text-slate-300">
      {t('materials.dimensions')}
      <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} className={`mt-1 ${field}`} placeholder={t('materials.detailsFoam')} />
    </label>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold">
          {material
            ? t('materials.editTitle')
            : t('materials.addCategoryTitle', { category: t(`materialCategory.${formKind}`) })}
        </h2>

        {formKind === 'fabric' && (
          <>
            <label className="text-sm text-slate-300">
              {t('materials.vendor')}
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`mt-1 ${field}`} />
            </label>
            {checkbox(isCom, setIsCom, t('materials.comCheckbox'))}
            <label className="text-sm text-slate-300">
              {t('materials.patternColor')}
              <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} placeholder={t('materials.name_fabric')} />
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.direction')}
              <select value={direction} onChange={(e) => setDirection(e.target.value)} className={`mt-1 ${field}`}>
                <option value="">—</option>
                {FABRIC_DIRECTIONS.map((d) => <option key={d} value={d}>{optLabel(d)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.notes')}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${field}`} placeholder={t('materials.fabricNotesPlaceholder')} />
            </label>
            <div className="flex gap-3">
              {qtyField}
              <label className="flex-1 text-sm text-slate-300">
                {t('materials.unit')}
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`mt-1 ${field}`}>
                  {FABRIC_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
            </div>
          </>
        )}

        {formKind === 'insert' && (
          <>
            {vendorSelect(INSERT_VENDORS)}
            {itemNameField}
            <div className="flex gap-3">
              {qtyField}
              {dimensionsField}
            </div>
            <label className="text-sm text-slate-300">
              {t('materials.notes')}
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`mt-1 ${field}`} />
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.type')}
              <select value={insertType} onChange={(e) => setInsertType(e.target.value)} required className={`mt-1 ${field}`}>
                <option value="">—</option>
                {INSERT_TYPES.map((v) => <option key={v} value={v}>{optLabel(v)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.blend')}
              <select value={blend} onChange={(e) => setBlend(e.target.value)} required className={`mt-1 ${field}`}>
                <option value="">—</option>
                {INSERT_BLENDS.map((v) => <option key={v} value={v}>{optLabel(v)}</option>)}
              </select>
            </label>
          </>
        )}

        {formKind === 'foam' && (
          <>
            {vendorSelect(FOAM_VENDORS)}
            {checkbox(customOrder, setCustomOrder, t('materials.wedgeCustom'))}
            {itemNameField}
            <div className="flex gap-3">
              {qtyField}
              {dimensionsField}
            </div>
            <label className="text-sm text-slate-300">
              {t('materials.type')}
              <select value={foamType} onChange={(e) => setFoamType(e.target.value)} required className={`mt-1 ${field}`}>
                <option value="">—</option>
                {FOAM_TYPES.map((v) => <option key={v} value={v}>{optLabel(v)}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.notes')}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${field}`} />
            </label>
          </>
        )}

        {formKind === 'hardware' && (
          <>
            {vendorSelect(HARDWARE_VENDORS)}
            {checkbox(customOrder, setCustomOrder, t('materials.customOrder'))}
            <label className="text-sm text-slate-300">
              {t('materials.item')}
              <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} placeholder={t('materials.name_hardware')} />
            </label>
            <div className="flex gap-3">
              {qtyField}
              <label className="flex-1 text-sm text-slate-300">
                {t('materials.unit')}
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`mt-1 ${field}`} placeholder={t('materials.unitPlaceholder')} />
              </label>
            </div>
            <label className="text-sm text-slate-300">
              {t('materials.details')}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${field}`} placeholder={t('materials.detailsHardware')} />
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.linkToProduct')}
              <input type="url" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} className={`mt-1 ${field}`} placeholder="https://…" />
            </label>
          </>
        )}

        {formKind === 'other' && (
          <>
            <label className="text-sm text-slate-300">
              {t('materials.name')}
              <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} placeholder={t('materials.namePlaceholder')} />
            </label>
            <label className="text-sm text-slate-300">
              {t('materials.details')}
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`mt-1 ${field}`} />
            </label>
            <div className="flex gap-3">
              {qtyField}
              <label className="flex-1 text-sm text-slate-300">
                {t('materials.unit')}
                <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`mt-1 ${field}`} placeholder={t('materials.unitPlaceholder')} />
              </label>
            </div>
            <label className="text-sm text-slate-300">
              {t('materials.supplier')}
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`mt-1 ${field}`} />
            </label>
          </>
        )}

        {checkbox(paymentRequired, setPaymentRequired, t('materials.paymentRequired'))}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
