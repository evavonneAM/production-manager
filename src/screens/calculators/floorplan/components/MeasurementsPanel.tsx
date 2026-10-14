import { useState } from 'react'
import { App as AntApp, Button, Card, Empty, Flex, Input, Modal, Popconfirm, Tag, Typography, theme } from 'antd'
import { CopyOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Engine } from '../engine/engine'
import { useEngine } from './useEngine'

export default function MeasurementsPanel({ engine: e }: { engine: Engine }) {
  useEngine(e)
  const { token } = theme.useToken()
  const { message } = AntApp.useApp()
  const [fallback, setFallback] = useState<string | null>(null)
  const list = e.pageMeas()
  const tot = e.totals()

  const copy = async () => {
    const text = e.listText()
    if (!text) {
      void message.info('Nothing to copy yet')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      void message.success(`Copied ${text.split('\n').filter((l) => l.includes(':')).length} lines`)
    } catch {
      setFallback(text)
    }
  }

  return (
    <Flex vertical gap={8}>
      {list.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Nothing measured on this page yet. Pick Line, Path or Area and click on the plan."
        />
      ) : (
        <Flex vertical gap={8} role="list">
          {list.map((mm) => {
            const sel = mm.id === e.sel
            return (
              <Card
                key={mm.id}
                size="small"
                hoverable
                role="listitem"
                onClick={() => e.select(mm.id)}
                style={{
                  borderColor: sel ? token.colorPrimary : undefined,
                  borderLeftWidth: sel ? 6 : 1,
                  background: sel ? token.colorPrimaryBg : undefined,
                }}
              >
                <Flex align="center" gap={8}>
                  <Tag color="blue" style={{ margin: 0, textTransform: 'uppercase' }}>
                    {mm.kind}
                  </Tag>
                  <Input
                    variant="borderless"
                    value={mm.name}
                    aria-label="Name for this measurement"
                    onChange={(ev) => e.rename(mm.id, ev.target.value)}
                    onClick={(ev) => ev.stopPropagation()}
                    style={{ fontWeight: 600, flex: 1, minWidth: 0 }}
                  />
                  <Button
                    danger
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    aria-label={`Delete ${mm.name}`}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      e.remove(mm.id)
                    }}
                  >
                    Delete
                  </Button>
                </Flex>
                <Typography.Text strong className="mono" style={{ fontSize: '1.2em', display: 'block' }}>
                  {e.measText(mm)}
                </Typography.Text>
                <Typography.Text type="secondary">{e.measSub(mm)}</Typography.Text>
              </Card>
            )
          })}
        </Flex>
      )}

      {tot.lines && (
        <Flex justify="space-between" align="baseline" style={{ borderTop: `2px solid ${token.colorText}`, paddingTop: 8 }}>
          <Typography.Text strong>All lines and paths</Typography.Text>
          <Typography.Text strong className="mono">
            {tot.lines}
          </Typography.Text>
        </Flex>
      )}
      {tot.areas && (
        <Flex justify="space-between" align="baseline" style={{ borderTop: `2px solid ${token.colorText}`, paddingTop: 8 }}>
          <Typography.Text strong>All areas</Typography.Text>
          <Typography.Text strong className="mono">
            {tot.areas}
          </Typography.Text>
        </Flex>
      )}

      <Flex wrap gap={8}>
        <Button icon={<CopyOutlined />} onClick={() => void copy()}>
          Copy list
        </Button>
        <Popconfirm
          title="Clear every measurement on this page?"
          okText="Clear"
          okButtonProps={{ danger: true }}
          onConfirm={() => e.clearPage()}
          disabled={!list.length}
        >
          <Button danger disabled={!list.length}>
            Clear this page
          </Button>
        </Popconfirm>
      </Flex>

      <Modal
        open={fallback != null}
        title="Copy this list"
        onCancel={() => setFallback(null)}
        footer={<Button onClick={() => setFallback(null)}>Close</Button>}
        afterOpenChange={(o) => {
          if (o) document.querySelector<HTMLTextAreaElement>('.fpm-copybox')?.select()
        }}
      >
        <Typography.Paragraph type="secondary">Your browser would not copy automatically. Select all and press ⌘C.</Typography.Paragraph>
        <Input.TextArea className="fpm-copybox mono" readOnly autoSize={{ minRows: 5, maxRows: 14 }} value={fallback ?? ''} />
      </Modal>
    </Flex>
  )
}
