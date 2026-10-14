import { useState } from 'react'
import { Alert, Button, Card, Flex, Form, Input, Segmented, Select, Typography } from 'antd'
import type { Engine } from '../engine/engine'
import { PRESET_GROUPS } from '../engine/geometry'
import type { Units } from '../engine/types'
import { useEngine } from './useEngine'

const OPTIONS = PRESET_GROUPS.map((g) => ({
  label: g.label,
  options: g.items.map(([v, l]) => ({ value: String(v), label: l })),
}))

function CalibForm({ engine: e }: { engine: Engine }) {
  const [ft, setFt] = useState('')
  const [inch, setInch] = useState('')
  const [m, setM] = useState('')
  const [err, setErr] = useState('')
  const imp = e.units === 'imp'
  const submit = () => {
    const msg = e.submitCalibration(ft, inch, m)
    setErr(msg || '')
  }
  return (
    <Card size="small" title="How long is that line in real life?" style={{ borderColor: 'var(--ant-color-primary)' }}>
      <Form layout="vertical" onFinish={submit} noValidate>
        {imp ? (
          <Flex gap={8}>
            <Form.Item label="Feet" style={{ flex: 1, marginBottom: 8 }}>
              <Input autoFocus inputMode="decimal" autoComplete="off" value={ft} onChange={(x) => setFt(x.target.value)} />
            </Form.Item>
            <Form.Item label="Inches" style={{ flex: 1, marginBottom: 8 }}>
              <Input inputMode="decimal" autoComplete="off" value={inch} onChange={(x) => setInch(x.target.value)} />
            </Form.Item>
          </Flex>
        ) : (
          <Form.Item label="Meters" style={{ marginBottom: 8 }}>
            <Input autoFocus inputMode="decimal" autoComplete="off" value={m} onChange={(x) => setM(x.target.value)} />
          </Form.Item>
        )}
        {imp && (
          <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
            Inches can be a fraction, like 6 1/2.
          </Typography.Paragraph>
        )}
        {err && <Alert type="error" showIcon title={err} style={{ marginBottom: 8 }} role="alert" />}
        <Flex gap={8} wrap>
          <Button type="primary" htmlType="submit">
            Use this scale
          </Button>
          <Button onClick={() => e.cancelCalibration()}>Cancel</Button>
        </Flex>
      </Form>
    </Card>
  )
}

export default function ScalePanel({ engine: e }: { engine: Engine }) {
  useEngine(e)
  const sc = e.curScale()
  const other = e.otherScalePage()
  const match =
    sc && sc.how === 'preset'
      ? PRESET_GROUPS.flatMap((g) => g.items).find(([v]) => Math.abs(v - sc.perFt) < 1e-6)?.[0]
      : undefined
  return (
    <Flex vertical gap={12}>
      {sc ? (
        <Alert
          type="info"
          showIcon
          title="Scale for this page"
          description={
            <Flex vertical gap={2}>
              <Typography.Text strong className="mono">
                {sc.label}
              </Typography.Text>
              <span>{sc.how === 'calib' ? 'Set from a line you measured.' : 'Picked from the printed scale.'}</span>
              <span>
                <b>Check it:</b> measure a dimension printed on the plan. If it matches, you are good.
              </span>
            </Flex>
          }
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          title="No scale yet"
          description={
            <Flex vertical gap={8} align="flex-start">
              <span>
                Click <b>Set scale</b>, then click both ends of a dimension you know (for example a wall marked 12'-0").
              </span>
              {other != null && (
                <Button size="small" onClick={() => e.copyScaleFrom(other)}>
                  Use the scale from page {other}
                </Button>
              )}
            </Flex>
          }
        />
      )}

      {e.pending && <CalibForm key={`${e.pending[0].x},${e.pending[0].y}`} engine={e} />}

      <Flex vertical gap={4}>
        <label htmlFor="preset" style={{ fontWeight: 600 }}>
          Or pick the printed drawing scale
        </label>
        <Select
          id="preset"
          placeholder="Choose a scale…"
          options={OPTIONS}
          disabled={!e.paper}
          value={match != null ? String(match) : undefined}
          onChange={(v, opt) => e.setPreset(parseFloat(v), (opt as { label: string }).label)}
        />
        <Typography.Text type="secondary" style={{ fontSize: '.9em' }}>
          {e.paper
            ? 'Only accurate if the PDF is the original drawing at full size, not a scan or a photo.'
            : 'Printed-scale choices only work for PDFs. For photos and images, use Set scale.'}
        </Typography.Text>
      </Flex>

      <Flex vertical gap={4}>
        <span style={{ fontWeight: 600 }}>Units</span>
        <Segmented
          block
          aria-label="Units"
          value={e.units}
          onChange={(v) => e.setUnits(v as Units)}
          options={[
            { label: 'Feet & inches', value: 'imp' },
            { label: 'Metric', value: 'met' },
          ]}
        />
      </Flex>

      {e.units === 'imp' && (
        <Flex vertical gap={4}>
          <label htmlFor="prec" style={{ fontWeight: 600 }}>
            Round inches to
          </label>
          <Select
            id="prec"
            value={e.prec}
            onChange={(v) => e.setPrec(v)}
            options={[
              { value: 16, label: '1/16"' },
              { value: 8, label: '1/8"' },
              { value: 4, label: '1/4"' },
              { value: 2, label: '1/2"' },
              { value: 1, label: '1"' },
            ]}
          />
        </Flex>
      )}
    </Flex>
  )
}
