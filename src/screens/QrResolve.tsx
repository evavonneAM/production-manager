import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getProjectIdByQr, getJobByQr, getMaterialJobIdByQr } from '../lib/data'
import { FullScreenLoader } from '../components/FullScreenLoader'

/** Resolves a QR deep link (by qr_code_uuid) to the right screen. */
export default function QrResolve({ kind }: { kind: 'project' | 'job' | 'material' }) {
  const { qr, mqr } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        let target: string | null = null
        if (kind === 'project' && qr) {
          const id = await getProjectIdByQr(qr)
          target = id ? `/projects/${id}` : null
        } else if (kind === 'job' && qr) {
          const job = await getJobByQr(qr)
          target = job ? `/jobs/${job.id}` : null
        } else if (kind === 'material' && mqr) {
          const jobId = await getMaterialJobIdByQr(mqr)
          target = jobId ? `/jobs/${jobId}` : null
        }
        if (!active) return
        if (target) navigate(target, { replace: true })
        else setNotFound(true)
      } catch {
        if (active) setNotFound(true)
      }
    })()
    return () => {
      active = false
    }
  }, [kind, qr, mqr, navigate])

  if (notFound) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-slate-300">{t('scan.notFound')}</p>
        <Link to="/scan" className="text-sm text-amber-400 hover:underline">
          {t('scan.tryAgain')}
        </Link>
      </div>
    )
  }
  return <FullScreenLoader />
}
