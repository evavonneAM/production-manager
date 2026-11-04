import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Empty, List, Modal, Spin, Tag, Typography, message } from 'antd'
import { FileAddOutlined, PlusOutlined } from '@ant-design/icons'
import { appendLines, errorText, estimateCode, listDraftEstimates, money, type EstimateSummary, type NewLine } from '../lib/estimates'

/**
 * "Add to estimate" for the pricing tools: sends every line at once, either to
 * a draft estimate or to a new one. Lines are built only when pressed.
 */
export function AddToEstimate({ lines, disabled }: { lines: () => NewLine[]; disabled?: boolean }) {
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
      await appendLines(e.id, lines())
      setOpen(false)
      navigate(`/estimates/${e.id}`)
    } catch (err) {
      msg.error(errorText(err))
    } finally {
      setBusy(null)
    }
  }

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
          onClick={() => navigate('/estimates/new', { state: { lines: lines() } })}
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
