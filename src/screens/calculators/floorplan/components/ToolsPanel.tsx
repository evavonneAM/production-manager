import { Button, Flex, Tag, Typography } from 'antd'
import type { Engine } from '../engine/engine'
import type { Tool } from '../engine/types'
import { useEngine } from './useEngine'

const TOOLS: { id: Tool; name: string; key: string; hint: string; wide?: boolean }[] = [
  { id: 'line', name: 'Line', key: 'L', hint: 'Two clicks: start, end' },
  { id: 'path', name: 'Path', key: 'P', hint: 'Several walls added up' },
  { id: 'area', name: 'Area', key: 'A', hint: 'Click room corners' },
  { id: 'pan', name: 'Move', key: 'H', hint: 'Drag the plan around' },
  { id: 'scale', name: 'Set scale', key: 'S', hint: 'Click both ends of a dimension you know', wide: true },
]

export default function ToolsPanel({ engine: e }: { engine: Engine }) {
  useEngine(e)
  const n = e.pts.length
  return (
    <>
      <div className="tools" role="group" aria-label="Measuring tools">
        {TOOLS.map((t) => {
          const on = e.tool === t.id
          return (
            <Button
              key={t.id}
              className={t.wide ? 'wide' : undefined}
              type={on ? 'primary' : 'default'}
              aria-pressed={on}
              onClick={() => e.setTool(t.id)}
            >
              <Flex vertical align="flex-start" gap={2}>
                <span style={{ fontWeight: 600 }}>
                  {t.name}{' '}
                  <Tag style={{ marginInlineEnd: 0 }} variant="outlined">
                    {t.key}
                  </Tag>
                </span>
                <span style={{ fontSize: '.85em', opacity: 0.85, fontWeight: 400 }}>{t.hint}</span>
              </Flex>
            </Button>
          )
        })}
      </div>
      {n > 0 && (
        <Flex wrap gap={8}>
          {e.canFinish() && (
            <Button type="primary" size="small" onClick={() => e.finish()}>
              Finish (Enter)
            </Button>
          )}
          <Button size="small" onClick={() => e.undoPoint()}>
            Undo point
          </Button>
          <Button size="small" onClick={() => e.cancelDraw()}>
            Cancel (Esc)
          </Button>
        </Flex>
      )}
      <Typography.Text type="secondary" style={{ fontSize: '.9em' }}>
        Drag to move the plan in any tool. Hold <b>Shift</b> to keep lines straight. Pinch, or hold <b>⌘</b> and scroll, to zoom.
      </Typography.Text>
    </>
  )
}
