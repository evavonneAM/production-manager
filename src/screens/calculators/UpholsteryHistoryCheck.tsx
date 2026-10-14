import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Collapse, Typography } from 'antd'
import type { HistoryRow } from '../../lib/calculators/upholsteryHistory'
import { ACCOUNT_CODE, FLAG_PCT, WIDTH_WINDOW, erLink, gapFrom, historyCheck } from '../../lib/calculators/upholsteryHistoryCheck'
import { money } from '../../lib/calculators/upholstery'

type Props = { typeId: string; service: 'up' | 'slip'; width: number; labor: number }

/** Compares this estimate's labor with what similar past pieces were priced at in Estimate Rocket. */
export default function UpholsteryHistoryCheck({ typeId, service, width, labor }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<HistoryRow[] | null>(null)

  // The price history is only downloaded when this screen opens.
  useEffect(() => {
    let alive = true
    import('../../lib/calculators/upholsteryHistory').then((m) => alive && setRows(m.default))
    return () => {
      alive = false
    }
  }, [])

  const check = useMemo(() => (rows ? historyCheck(rows, typeId, service, width) : null), [rows, typeId, service, width])

  if (!rows) return null
  if (!check) return <Alert style={{ marginTop: 16 }} type="info" showIcon message={t('upholstery.hist.title')} description={t('upholstery.hist.none')} />

  const gap = gapFrom(labor, check.median)
  const off = Math.abs(gap) > FLAG_PCT
  const pct = Math.round(Math.abs(gap) * 100)
  const basis = [
    t('upholstery.hist.basisN', { count: check.n }),
    check.sizeMatched ? t('upholstery.hist.basisSize', { n: WIDTH_WINDOW }) : null,
    check.recentOnly ? t('upholstery.hist.basisRecent') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Alert
      style={{ marginTop: 16 }}
      type={off ? 'warning' : 'success'}
      showIcon
      message={
        <span>
          <Typography.Text strong>{t('upholstery.hist.title')}: </Typography.Text>
          {t('upholstery.hist.range', { low: money(check.low), high: money(check.high), median: money(check.median) })}
        </span>
      }
      description={
        <div style={{ display: 'grid', gap: 6 }}>
          <div>
            {off
              ? t(gap > 0 ? 'upholstery.hist.higher' : 'upholstery.hist.lower', { labor: money(labor), pct })
              : t('upholstery.hist.inLine', { labor: money(labor) })}
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {basis}. {t('upholstery.hist.laborOnly')}
            {check.usedUpholstery ? ` ${t('upholstery.hist.slipFallback')}` : ''}
          </Typography.Text>
          <Collapse
            size="small"
            ghost
            items={[
              {
                key: 'jobs',
                label: t('upholstery.hist.showJobs'),
                children: (
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {check.examples.map((j) => (
                      <li key={j.ref + j.name + j.price} style={{ overflowWrap: 'anywhere' }}>
                        <a href={erLink(j)} target="_blank" rel="noreferrer">
                          {ACCOUNT_CODE[j.account]} {j.number}
                        </a>{' '}
                        · {money(j.price)} · {j.name}
                        <Typography.Text type="secondary">
                          {' '}
                          · {j.width > 0 ? `${j.width}" W · ` : ''}
                          {j.date}
                        </Typography.Text>
                      </li>
                    ))}
                  </ul>
                ),
              },
            ]}
          />
        </div>
      }
    />
  )
}
