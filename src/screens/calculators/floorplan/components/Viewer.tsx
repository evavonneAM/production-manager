import { useEffect, useRef, useState } from 'react'
import { Alert, Spin, theme } from 'antd'
import type { Engine } from '../engine/engine'
import { useEngine } from './useEngine'

export default function Viewer({ engine: e }: { engine: Engine }) {
  useEngine(e)
  const { token } = theme.useToken()
  const vp = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const base = useRef<HTMLCanvasElement>(null)
  const det = useRef<HTMLCanvasElement>(null)
  const ov = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)
  const dragN = useRef(0)

  useEffect(() => {
    const detach = e.attach({ vp: vp.current!, stage: stage.current!, base: base.current!, det: det.current!, ov: ov.current! })
    // The sample plan draws text with the web fonts, so wait for them (or 1.5 s).
    let started = false
    const start = () => {
      if (started) return
      started = true
      e.loadSample()
    }
    const t = window.setTimeout(start, 1500)
    if (document.fonts?.ready) void document.fonts.ready.then(start, start)
    else start()
    return () => {
      clearTimeout(t)
      detach()
    }
  }, [e])

  const hint = e.hint()
  return (
    <section
      className="viewer"
      aria-label="Plan"
      style={{ background: token.colorFillTertiary }}
      onDragEnter={(ev) => {
        ev.preventDefault()
        dragN.current++
        setDragging(true)
      }}
      onDragOver={(ev) => ev.preventDefault()}
      onDragLeave={() => {
        dragN.current = Math.max(0, dragN.current - 1)
        if (!dragN.current) setDragging(false)
      }}
      onDrop={(ev) => {
        ev.preventDefault()
        dragN.current = 0
        setDragging(false)
        e.openFile(ev.dataTransfer.files?.[0])
      }}
    >
      <div className="vp" ref={vp}>
        <div className="pad">
          <div className="stage" ref={stage}>
            <canvas ref={base} />
            <canvas ref={det} />
            <svg ref={ov} xmlns="http://www.w3.org/2000/svg" />
          </div>
        </div>
      </div>
      <div className="hint" aria-live="polite">
        <Alert type={hint.warn ? 'warning' : 'info'} showIcon title={hint.msg} />
      </div>
      {e.loading && (
        <div className="loading">
          <Spin description="Opening…" />
        </div>
      )}
      {dragging && <div className="drop">Drop to open</div>}
    </section>
  )
}
