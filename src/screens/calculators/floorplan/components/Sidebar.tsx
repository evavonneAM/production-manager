import { Divider, Typography } from 'antd'
import type { Engine } from '../engine/engine'
import StepsPanel from './StepsPanel'
import ToolsPanel from './ToolsPanel'
import ScalePanel from './ScalePanel'
import MeasurementsPanel from './MeasurementsPanel'

const H = ({ children }: { children: string }) => (
  <Typography.Title level={5} style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '.06em' }}>
    {children}
  </Typography.Title>
)

export default function Sidebar({ engine }: { engine: Engine }) {
  return (
    <>
      <H>Steps</H>
      <StepsPanel engine={engine} />
      <Divider style={{ margin: '12px 0' }} />
      <H>Tools</H>
      <ToolsPanel engine={engine} />
      <Divider style={{ margin: '12px 0' }} />
      <H>Scale</H>
      <ScalePanel engine={engine} />
      <Divider style={{ margin: '12px 0' }} />
      <H>Measurements</H>
      <MeasurementsPanel engine={engine} />
    </>
  )
}
