import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Button, Flex, Space, Typography, theme } from 'antd'
import {
  ArrowLeftOutlined,
  ExpandOutlined,
  FolderOpenOutlined,
  LeftOutlined,
  MinusOutlined,
  PlusOutlined,
  RightOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import type { Engine } from '../engine/engine'
import { useEngine } from './useEngine'

export default function Header({ engine: e, onDisplay }: { engine: Engine; onDisplay: () => void }) {
  useEngine(e)
  const { token } = theme.useToken()
  const file = useRef<HTMLInputElement>(null)
  return (
    <Flex
      wrap
      align="center"
      gap={12}
      component="header"
      style={{
        padding: '10px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px))',
        borderBottom: `4px solid ${token.colorPrimary}`,
        background: token.colorBgContainer,
      }}
    >
      <Link to="/tools" aria-label="Back to Tools">
        <Button icon={<ArrowLeftOutlined />} type="text" />
      </Link>
      <Typography.Title level={4} style={{ margin: 0, color: token.colorPrimary }}>
        Floorplan Measure
      </Typography.Title>
      <Button type="primary" icon={<FolderOpenOutlined />} onClick={() => file.current?.click()}>
        Open PDF or image
      </Button>
      <input
        ref={file}
        type="file"
        hidden
        accept="application/pdf,.pdf,image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg"
        onChange={(ev) => {
          e.openFile(ev.target.files?.[0])
          ev.target.value = ''
        }}
      />
      <Typography.Text strong ellipsis={{ tooltip: e.name }} style={{ maxWidth: '28ch' }}>
        {e.name}
      </Typography.Text>
      {e.pages > 1 && (
        <Space.Compact>
          <Button icon={<LeftOutlined />} disabled={e.page <= 1} onClick={() => e.prevPage()} aria-label="Previous page" />
          <Button disabled style={{ color: token.colorText, cursor: 'default' }} className="mono">
            {e.page} / {e.pages}
          </Button>
          <Button icon={<RightOutlined />} disabled={e.page >= e.pages} onClick={() => e.nextPage()} aria-label="Next page" />
        </Space.Compact>
      )}
      <Space.Compact>
        <Button icon={<MinusOutlined />} onClick={() => e.zoomOut()} aria-label="Zoom out" />
        <Button disabled style={{ color: token.colorText, cursor: 'default', minWidth: '5.5ch' }} className="mono">
          {Math.round(e.zoom * 100)}%
        </Button>
        <Button icon={<PlusOutlined />} onClick={() => e.zoomIn()} aria-label="Zoom in" />
        <Button icon={<ExpandOutlined />} onClick={() => e.fitZoom()}>
          Fit
        </Button>
      </Space.Compact>
      <div style={{ flex: 1 }} />
      <Button icon={<SettingOutlined />} onClick={onDisplay}>
        Display
      </Button>
    </Flex>
  )
}
