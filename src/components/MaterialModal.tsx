import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { createMaterial, updateMaterial, type MaterialCategory } from '../lib/data'
import type { Material } from '../lib/types'

const CATEGORIES: MaterialCategory[] = ['fabric', 'com', 'insert', 'other']

/** Add (material == null) or edit a material. Procurement + Admin only (RLS-enforced). */
export function MaterialModal({
  jobId,
  material,
  onClose,
  onSaved,
}: {
  jobId: string
  material: Material | null
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(material?.name ?? '')
  const [category, setCategory] = useState<MaterialCategory>(
    (material?.category as MaterialCategory) ?? 'other',
  )
  const [description, setDescription] = useState(material?.description ?? '')
  const [quantity, setQuantity] = useState(material ? String(material.quantity) : '1')
  const [unit, setUnit] = useState(material?.unit ?? '')
  const [supplier, setSupplier] = useState(material?.supplier ?? '')
  const [paymentRequired, setPaymentRequired] = useState(material?.payment_required ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !quantity) return
    setBusy(true)
    setError(null)
    const shared = {
      quantity: Number(quantity),
      unit: unit.trim() || null,
      supplier: supplier.trim() || null,
      description: description.trim() || null,
      category,
      payment_required: paymentRequired,
    }
    const result = material
      ? await updateMaterial(material.id, {
          ...(name.trim() !== material.name ? { name: name.trim() } : {}),
          ...shared,
        })
      : await createMaterial({ jobId, name: name.trim(), ...shared })
    setBusy(false)
    if (result.error) setError(t('common.error'))
    else onSaved()
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5"
      >
        <h2 className="text-lg font-semibold">
          {material ? t('materials.editTitle') : t('materials.addTitle')}
        </h2>

        <label className="text-sm text-slate-300">
          {t('materials.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} required className={`mt-1 ${field}`} placeholder={t('materials.namePlaceholder')} />
        </label>

        <label className="text-sm text-slate-300">
          {t('materials.category')}
          <select value={category} onChange={(e) => setCategory(e.target.value as MaterialCategory)} className={`mt-1 ${field}`}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`materialCategory.${c}`)}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-slate-300">
          {t('materials.details')}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={`mt-1 ${field}`}
            placeholder={t('materials.detailsPlaceholder')}
          />
        </label>

        <div className="flex gap-3">
          <label className="w-28 text-sm text-slate-300">
            {t('materials.qty')}
            <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required className={`mt-1 ${field}`} />
          </label>
          <label className="flex-1 text-sm text-slate-300">
            {t('materials.unit')}
            <input value={unit} onChange={(e) => setUnit(e.target.value)} className={`mt-1 ${field}`} placeholder={t('materials.unitPlaceholder')} />
          </label>
        </div>

        <label className="text-sm text-slate-300">
          {t('materials.supplier')}
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className={`mt-1 ${field}`} />
        </label>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={paymentRequired}
            onChange={(e) => setPaymentRequired(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-800 accent-amber-600"
          />
          {t('materials.paymentRequired')}
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="mt-1 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-800">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className="flex-1 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60">
            {busy ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
