import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Empty, List, Modal, Spin, Tag, Typography, message } from 'antd'
import { FileAddOutlined, PlusOutlined } from '@ant-design/icons'
import { errorText, estimateCode, listDraftEstimates, money, sendWorksheet, type EstimateSummary, type NewLine, type WorksheetTool } from '../lib/estimates'
import type { EstimateLink } from '../lib/estimateLink'

/**
 * "Add to estimate" for the pricing tools: sends every line at once, with the
 * tool's worksheet (its inputs) so the lines can be reopened in the tool.
 * Opened from an estimate (link), it adds straight to it — or, for a reopened
 * worksheet, replaces that worksheet's lines — and goes back. Otherwise it
 * asks which draft, or starts a new estimate. Lines are built only when pressed.
 */
export function AddToEstimate({
  lines,
  input,
  tool,
  link,
  disabled,
}: {
  lines: () => NewLine[]
  input: () => unknown
  tool: WorksheetTool
  link?: EstimateLink | null
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [msg, ctx] = message.useMessage()
  const [open, setOpen] = useState(false)
  const [drafts, setDrafts] = useState<EstimateSummary[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const show = async () => {
    setOpen(true)
    setDrafts(null)
    try {
      setDrafts(await listDraftEstimates())
    } catch (e) {
      msg.error(errorText(e))
      setDrafts([])
    }
  }

  const addTo = async (e: EstimateSummary) => {
    setBusy(e.id)
    try {
      await sendWorksheet(e.id, tool, input(), lines())
      setOpen(false)
      navigate(`/estimates/${e.id}`)
    } catch (err) {
      msg.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  const sendToLink = async () => {
    if (!link) return
    setBusy(link.estimateId)
    try {
      await sendWorksheet(link.estimateId, tool, input(), lines(), { worksheet: link.worksheet, groupId: link.groupId })
      navigate(`/estimates/${link.estimateId}`)
    } catch (err) {
      msg.error(errorText(err))
      setBusy(null)
    }
  }

  if (link)
    return (
      <>
        {ctx}
        <Button type="primary" icon={<FileAddOutlined />} disabled={disabled || link.locked} loading={!!busy} onClick={sendToLink}>
          {link.worksheet
            ? t('estimates.updateIn', { code: link.code })
            : link.groupName
              ? t('estimates.addToRoom', { code: link.code, room: link.groupName })
              : t('estimates.addTo', { code: link.code })}
        </Button>
      </>
    )

  return (
    <>
      {ctx}
      <Button icon={<FileAddOutlined />} disabled={disabled} onClick={show}>
        {t('estimates.addToEstimate')}
      </Button>
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} title={t('estimates.addToEstimate')}>
        <Typography.Paragraph type="secondary">{t('estimates.addHelp', { count: open ? lines().length : 0 })}</Typography.Paragraph>
        <Button
          type="primary"
          block
          size="large"
          icon={<PlusOutlined />}
          onClick={() => {
            const spec = { tool, version: 1 as const, worksheet: crypto.randomUUID(), input: input() }
            navigate('/estimates/new', { state: { lines: lines().map((l) => ({ ...l, spec })) } })
          }}
        >
          {t('estimates.newWithLines')}
        </Button>
        <Typography.Title level={5} style={{ marginTop: 20 }}>
          {t('estimates.orDraft')}
        </Typography.Title>
        {drafts === null ? (
          <Spin />
        ) : drafts.length === 0 ? (
          <Empty description={t('estimates.noDrafts')} />
        ) : (
          <List
            dataSource={drafts}
            renderItem={(e) => (
              <List.Item
                actions={[
                  <Button key="add" loading={busy === e.id} disabled={!!busy && busy !== e.id} onClick={() => addTo(e)}>
                    {t('estimates.add')}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <>
                      <Tag>{estimateCode(e)}</Tag>
                      {e.client?.name || t('estimates.noClient')}
                    </>
                  }
                  description={[e.title, money(e.total)].filter(Boolean).join(' · ')}
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  )
}

/** Shown at the top of a pricing tool opened from an estimate. */
export function EstimateLinkBanner({ link, error }: { link: EstimateLink | null; error?: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  if (error) return <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />
  if (!link) return null
  if (link.locked)
    return (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={t('estimates.lockedTool', { code: link.code })}
        action={<Button onClick={() => navigate(`/estimates/${link.estimateId}`)}>{t('estimates.backToEstimate')}</Button>}
      />
    )
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      title={
        link.worksheet
          ? t('estimates.bannerReopen', { code: link.code })
          : link.groupName
            ? t('estimates.bannerAddRoom', { code: link.code, room: link.groupName })
            : t('estimates.bannerAdd', { code: link.code })
      }
      action={<Button onClick={() => navigate(`/estimates/${link.estimateId}`)}>{t('estimates.backToEstimate')}</Button>}
    />
  )
}
