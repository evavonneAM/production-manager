import { useEffect, useState } from 'react'
import { App as AntApp, Grid, theme } from 'antd'
import type { Engine } from '../engine/engine'
import type { Disp } from '../display'
import Header from './Header'
import Viewer from './Viewer'
import Sidebar from './Sidebar'
import DisplayDrawer from './DisplayDrawer'

type Props = { engine: Engine; disp: Disp; setDisp: (p: Partial<Disp>) => void }

export default function Shell({ engine, disp, setDisp }: Props) {
  const { token } = theme.useToken()
  const { message } = AntApp.useApp()
  const screens = Grid.useBreakpoint()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    engine.toast = (m) => void message.success(m)
  }, [engine, message])

  const stacked = screens.md === false
  return (
    <div className="fpm" style={{ background: token.colorBgContainer, color: token.colorText, fontFamily: token.fontFamily, fontSize: token.fontSize, lineHeight: token.lineHeight }}>
      <Header engine={engine} onDisplay={() => setOpen(true)} />
      <main className="work" style={stacked ? undefined : { gridTemplateColumns: 'minmax(0,1fr) 380px' }}>
        <Viewer engine={engine} />
        <aside
          className="side"
          style={{
            borderLeft: stacked ? 'none' : `2px solid ${token.colorBorderSecondary}`,
            borderTop: stacked ? `4px solid ${token.colorPrimary}` : 'none',
            background: token.colorBgContainer,
          }}
        >
          <Sidebar engine={engine} />
        </aside>
      </main>
      <DisplayDrawer open={open} onClose={() => setOpen(false)} disp={disp} setDisp={setDisp} />
    </div>
  )
}
