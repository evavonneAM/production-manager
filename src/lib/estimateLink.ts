import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { estimateCode, getEstimateBrief, getWorksheet } from './estimates'

/**
 * A pricing tool opened from an estimate: ?estimate=<id>[&group=<id>][&worksheet=<id>].
 * "Add cushion" opens the tool with estimate (+ room); "Open in Cushion Pricing"
 * adds the worksheet, whose saved inputs are handed to the tool once.
 */
export type EstimateLink = {
  estimateId: string
  /** HOV10002 */
  code: string
  groupId: string | null
  groupName: string | null
  worksheet: string | null
}

export function useEstimateLink(onInput: (input: unknown) => void): {
  link: EstimateLink | null
  loading: boolean
  error: string | null
} {
  const [params] = useSearchParams()
  const estimateId = params.get('estimate')
  const groupParam = params.get('group')
  const worksheet = params.get('worksheet')
  const [link, setLink] = useState<EstimateLink | null>(null)
  const [loading, setLoading] = useState(!!estimateId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!estimateId) return
    let live = true
    Promise.all([getEstimateBrief(estimateId), worksheet ? getWorksheet(estimateId, worksheet) : Promise.resolve(null)])
      .then(([est, ws]) => {
        if (!live) return
        const groupId = ws ? ws.groupId : groupParam
        const group = est.groups.find((g) => g.id === groupId) ?? null
        setLink({
          estimateId,
          code: estimateCode(est),
          groupId: group?.id ?? null,
          groupName: group ? group.name.trim() || null : null,
          worksheet: ws ? worksheet : null,
        })
        if (ws) onInput(ws.input)
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
    // onInput is read once when the worksheet loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimateId, groupParam, worksheet])

  return { link, loading, error }
}
