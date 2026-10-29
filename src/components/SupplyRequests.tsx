import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Avatar, Button, Card, Image, Input, Modal, Space, Tag, Typography, theme } from 'antd'
import { CameraOutlined, CloseOutlined, LinkOutlined } from '@ant-design/icons'
import { useAsync } from '../hooks/useAsync'
import { REQUEST_STATUS_COLOR, createSupplyRequest, getRequestableJobs, type SupplyRequest } from '../lib/supplyRequests'
import { formatDate } from '../lib/format'

/** The "Request supplies" form (Tools page + Ordering → Requests). */
export function SupplyRequestModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const { data: jobs } = useAsync(() => (open ? getRequestableJobs() : Promise.resolve([])), [open])
  const [item, setItem] = useState('')
  const [quantity, setQuantity] = useState('')
  const [jobId, setJobId] = useState('')
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // Free the preview URLs when the form goes away.
  const photosRef = useRef(photos)
  useEffect(() => {
    photosRef.current = photos
  }, [photos])
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  function reset() {
    setItem('')
    setQuantity('')
    setJobId('')
    setLink('')
    setNote('')
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    setPhotos([])
    setError(null)
  }

  async function send() {
    if (!item.trim()) return
    setBusy(true)
    setError(null)
    const res = await createSupplyRequest({ item, quantity, jobId: jobId || null, link, note, photos: photos.map((p) => p.file) })
    setBusy(false)
    if (res.error) setError(res.error === 'too_large' ? t('supplyRequests.tooLarge') : t('common.error'))
    else {
      reset()
      onSent()
    }
  }

  // Native <select> (Ant Select has frozen in the owner's browser), styled like an Ant input.
  const selectStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    height: 32,
    padding: '0 8px',
    fontSize: 14,
    color: token.colorText,
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorder}`,
    borderRadius: token.borderRadius,
  }
  const label = (text: string) => (
    <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12, marginBottom: 2 }}>
      {text}
    </Typography.Text>
  )

  return (
    <Modal
      open={open}
      title={t('supplyRequests.formTitle')}
      onCancel={onClose}
      onOk={() => void send()}
      okText={t('supplyRequests.send')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !item.trim() }}
      confirmLoading={busy}
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <div>
          {label(t('supplyRequests.item'))}
          <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder={t('supplyRequests.itemPlaceholder')} />
        </div>
        <div>
          {label(t('supplyRequests.quantity'))}
          <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('supplyRequests.quantityPlaceholder')} />
        </div>
        <div>
          {label(t('supplyRequests.job'))}
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={selectStyle}>
            <option value="">{t('supplyRequests.noJob')}</option>
            {(jobs ?? []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.job_code} · {j.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          {label(t('supplyRequests.link'))}
          <Input prefix={<LinkOutlined />} value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('supplyRequests.linkPlaceholder')} inputMode="url" />
        </div>
        <div>
          {label(t('supplyRequests.photos'))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {photos.map((p, i) => (
              <div key={p.url} style={{ position: 'relative' }}>
                <img src={p.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                <Button
                  size="small"
                  shape="circle"
                  icon={<CloseOutlined />}
                  aria-label={t('common.cancel')}
                  onClick={() => {
                    URL.revokeObjectURL(p.url)
                    setPhotos(photos.filter((_, j) => j !== i))
                  }}
                  style={{ position: 'absolute', top: -8, right: -8 }}
                />
              </div>
            ))}
            <Button
              icon={<CameraOutlined />}
              onClick={() => fileRef.current?.click()}
              style={{ width: 64, height: 64, borderStyle: 'dashed', display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}
            >
              {t('supplyRequests.addPhoto')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                setPhotos([...photos, ...Array.from(e.target.files ?? []).map((file) => ({ file, url: URL.createObjectURL(file) }))])
                e.target.value = ''
              }}
            />
          </div>
        </div>
        <div>
          {label(t('supplyRequests.note'))}
          <Input.TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error && <Alert type="error" showIcon title={error} />}
      </Space>
    </Modal>
  )
}

/** One request: what, how much, job, link, photos, note, who/when, status. */
export function SupplyRequestCard({
  req,
  photos,
  who,
  actions,
}: {
  req: SupplyRequest
  photos: Map<string, string>
  who?: string
  actions?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { token } = theme.useToken()
  const href = req.link && (/^https?:\/\//i.test(req.link) ? req.link : `https://${req.link}`)
  return (
    <Card styles={{ body: { padding: 14 } }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <Typography.Text strong>{req.item}</Typography.Text>
        <Tag color={REQUEST_STATUS_COLOR[req.status]} style={{ marginInlineEnd: 0, flexShrink: 0 }}>
          {t(`supplyRequests.status_${req.status}`)}
        </Tag>
      </div>
      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
        {[req.quantity].filter(Boolean).join('')}
        {req.quantity && ' · '}
        {req.job ? (
          <>
            {t('supplyRequests.forJob')}{' '}
            <Link to={`/jobs/${req.job.id}`} style={{ fontFamily: token.fontFamilyCode }}>
              {req.job.job_code}
            </Link>
          </>
        ) : (
          t('supplyRequests.shopStock')
        )}
      </Typography.Text>
      {(req.photo_paths.length > 0 || href) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Image.PreviewGroup>
            {req.photo_paths.map((p) =>
              photos.get(p) ? (
                <Image key={p} src={photos.get(p)} width={44} height={44} style={{ objectFit: 'cover', borderRadius: 6 }} />
              ) : null,
            )}
          </Image.PreviewGroup>
          {href && (
            <a href={href} target="_blank" rel="noreferrer" style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              <LinkOutlined /> {req.link}
            </a>
          )}
        </div>
      )}
      {req.note && (
        <Typography.Paragraph style={{ margin: '8px 0 0', padding: '8px 10px', background: token.colorFillQuaternary, borderRadius: 8, fontSize: 13 }}>
          {req.note}
        </Typography.Paragraph>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 10 }}>
        {who && (
          <Avatar size={22} style={{ fontSize: 11, background: token.colorPrimaryBg, color: token.colorPrimary }}>
            {who.split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </Avatar>
        )}
        <Typography.Text type="secondary" style={{ fontSize: 12, flex: 1 }}>
          {[who, formatDate(req.created_at, i18n.language)].filter(Boolean).join(' · ')}
        </Typography.Text>
        {actions}
      </div>
    </Card>
  )
}
