import { Button, Drawer, Flex, Segmented, Select, Slider, Typography } from 'antd'
import { CheckOutlined } from '@ant-design/icons'
import { MARKS, type MarkKey } from '../engine/types'
import type { Disp } from '../display'

type Props = { open: boolean; onClose: () => void; disp: Disp; setDisp: (p: Partial<Disp>) => void }

const Row = ({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) => (
  <Flex vertical gap={4}>
    <Flex justify="space-between">
      <Typography.Text strong>{label}</Typography.Text>
      {value && <Typography.Text className="mono">{value}</Typography.Text>}
    </Flex>
    {children}
  </Flex>
)

export default function DisplayDrawer({ open, onClose, disp, setDisp }: Props) {
  return (
    <Drawer title="Display" open={open} onClose={onClose} size={360}>
      <Flex vertical gap={20}>
        <Row label="Text size" value={`${disp.size}px`}>
          <Slider min={14} max={24} step={1} value={disp.size} onChange={(v) => setDisp({ size: v })} aria-label="Text size" />
        </Row>
        <Row label="Line spacing" value={disp.lh.toFixed(2)}>
          <Slider min={1.3} max={2} step={0.05} value={disp.lh} onChange={(v) => setDisp({ lh: v })} aria-label="Line spacing" />
        </Row>
        <Row label="Font">
          <Select
            value={disp.font}
            onChange={(v) => setDisp({ font: v })}
            options={[
              { value: 'default', label: 'System default' },
              { value: 'inter', label: 'Inter' },
              { value: 'atkinson', label: 'Atkinson Hyperlegible' },
            ]}
          />
        </Row>
        <Row label="Contrast">
          <Segmented
            block
            value={disp.contrast}
            onChange={(v) => setDisp({ contrast: v as Disp['contrast'] })}
            options={[
              { label: 'Normal', value: 'normal' },
              { label: 'High', value: 'high' },
            ]}
          />
        </Row>
        <Row label="Theme">
          <Segmented
            block
            value={disp.theme}
            onChange={(v) => setDisp({ theme: v as Disp['theme'] })}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
          />
        </Row>
        <Row label="Measurement color on the plan">
          <Flex gap={10} wrap role="group" aria-label="Measurement color">
            {(Object.keys(MARKS) as MarkKey[]).map((k) => (
              <Button
                key={k}
                shape="circle"
                size="large"
                aria-label={k}
                aria-pressed={disp.mark === k}
                title={k}
                onClick={() => setDisp({ mark: k })}
                style={{ background: MARKS[k], borderColor: MARKS[k], color: '#fff' }}
                icon={disp.mark === k ? <CheckOutlined /> : undefined}
              />
            ))}
          </Flex>
        </Row>
      </Flex>
    </Drawer>
  )
}
