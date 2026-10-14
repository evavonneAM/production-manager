import { Alert, Steps } from 'antd'
import type { Engine } from '../engine/engine'
import { useEngine } from './useEngine'

export default function StepsPanel({ engine: e }: { engine: Engine }) {
  useEngine(e)
  const sc = e.curScale()
  const count = e.pageMeas().length
  return (
    <>
      <Steps
        orientation="vertical"
        size="small"
        items={[
          {
            title: e.sample ? 'Open your plan (showing a sample)' : 'Plan open: ' + e.name,
            status: e.sample ? 'process' : 'finish',
          },
          {
            title: 'Set the scale' + (e.pages > 1 ? ' for page ' + e.page : ''),
            status: sc ? 'finish' : e.sample ? 'wait' : 'process',
          },
          {
            title: 'Check it on a printed dimension, then measure',
            content: count ? `${count} saved` : undefined,
            status: sc && count ? 'finish' : sc && !e.sample ? 'process' : 'wait',
          },
        ]}
      />
      {e.loadError && <Alert type="error" showIcon title={e.loadError} role="alert" />}
    </>
  )
}
