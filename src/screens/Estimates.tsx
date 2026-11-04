import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Card, Collapse, Empty, Input, InputNumber, Segmented, Select, Space, Tag, Typography, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useAsync } from '../hooks/useAsync'
import { FullScreenLoader } from '../components/FullScreenLoader'
import { formatDate } from '../lib/format'
import {
  ESTIMATE_STATUSES,
  STATUS_COLOR,
  STORES,
  estimateCode,
  getNextNumber,
  listEstimates,
  money,
  setNextNumber,
  type EstimateStatus,
  type Store,
  errorText,
} from '../lib/estimates'

/** Next estimate number, shared by all three businesses (Admins can move it forward or back). */
function Numbering() {
  const { t } = useTranslation()
  const [msg, ctx] = message.useMessage()
  const next = useAsync(getNextNumber, [])
  const [edit, setEdit] = useState<number | undefined>()
  if (next.loading) return null
  if (next.error) return <Alert type="error" title={next.error} />
  const save = async () => {
    if (!edit) return
    try {
      await setNextNumber(edit)
      msg.success(t('estimates.saved'))
    } catch (e) {
      msg.error(errorText(e))
    }
  }
  return (
    <>
      {ctx}
      <Typography.Paragraph type="secondary">{t('estimates.numberingHelp')}</Typography.Paragraph>
      <Space wrap>
        <InputNumber
          aria-label={t('estimates.nextNumber')}
          min={1}
          precision={0}
          value={edit ?? next.data ?? undefined}
          onChange={(v) => setEdit(v ?? undefined)}
          style={{ width: 160 }}
        />
        <Button disabled={!edit || edit === next.data} onClick={save}>
          {t('common.save')}
        </Button>
      </Space>
    </>
  )
}

/** Estimates list (Admins only): every business's estimates, newest first. */
export default function Estimates() {
  const { t, i18n } = useTranslation()
  const list = useAsync(listEstimates, [])
  const [store, setStore] = useState<Store | 'all'>('all')
  const [status, setStatus] = useState<EstimateStatus | 'all'>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (list.data ?? []).filter(
      (e) =>
        (store === 'all' || e.store === store) &&
        (status === 'all' || e.status === status) &&
        (!q || [estimateCode(e), e.title, e.client?.name, e.client?.company].join(' ').toLowerCase().includes(q)),
    )
  }, [list.data, store, status, query])

  if (list.loading) return <FullScreenLoader />

  return (
    <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '24px 16px 48px' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <div>
          <Typography.Title level={3} style={{ marginBottom: 4 }}>
            {t('estimates.title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('estimates.subtitle')}</Typography.Text>
        </div>
        <Link to="/estimates/new">
          <Button type="primary" size="large" icon={<PlusOutlined />}>
            {t('estimates.new')}
          </Button>
        </Link>
      </Space>

      {list.error && <Alert type="error" title={list.error} style={{ marginTop: 16 }} />}

      <Space orientation="vertical" size={12} style={{ width: '100%', marginTop: 20 }}>
        <Segmented
          block
          value={store}
          onChange={(v) => setStore(v as Store | 'all')}
          options={[{ value: 'all', label: t('estimates.all') }, ...STORES.map((s) => ({ value: s, label: s }))]}
        />
        <Space.Compact style={{ width: '100%' }}>
          <Select
            aria-label={t('estimates.status')}
            value={status}
            onChange={setStatus}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: t('estimates.allStatuses') },
              ...ESTIMATE_STATUSES.map((s) => ({ value: s, label: t(`estimates.statuses.${s}`) })),
            ]}
          />
          <Input.Search allowClear placeholder={t('estimates.search')} aria-label={t('estimates.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </Space.Compact>

        {rows.length === 0 && <Empty description={t('estimates.none')} style={{ marginTop: 32 }} />}

        {rows.map((e) => (
          <Link key={e.id} to={`/estimates/${e.id}`} style={{ display: 'block' }}>
            <Card hoverable size="small">
              <Space style={{ width: '100%', justifyContent: 'space-between' }} align="start" wrap>
                <div>
                  <Space size={8} wrap>
                    <Typography.Text strong>{estimateCode(e)}</Typography.Text>
                    <Tag color={STATUS_COLOR[e.status]}>{t(`estimates.statuses.${e.status}`)}</Tag>
                  </Space>
                  <div>{e.client?.name || t('estimates.noClient')}</div>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    {[e.title, formatDate(e.estimate_date, i18n.language)].filter(Boolean).join(' · ')}
                  </Typography.Text>
                </div>
                <Typography.Text strong style={{ fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
                  {money(e.total)}
                </Typography.Text>
              </Space>
            </Card>
          </Link>
        ))}

        <Collapse style={{ marginTop: 16 }} items={[{ key: 'n', label: t('estimates.numbering'), children: <Numbering /> }]} />
      </Space>
    </div>
  )
}
