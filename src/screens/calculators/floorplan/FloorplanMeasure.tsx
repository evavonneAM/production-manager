import { useEffect, useMemo, useRef } from 'react'
import { App as AntApp, ConfigProvider, theme as antTheme, type ThemeConfig } from 'antd'
import { Engine } from './engine/engine'
import { FONT_STACKS, useDisplay, useSystemDark } from './display'
import Shell from './components/Shell'
import './floorplan.css'

const PRIMARY = '#1677ff'
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@500;600&family=Inter:wght@400;600;700&display=swap'

/** The Display drawer's font choices and the number font come from Google Fonts; load them once. */
function useFonts() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_URL}"]`)) return
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = FONTS_URL
    document.head.appendChild(l)
  }, [])
}

/** Floorplan Measure: open a floor plan PDF or image, set the scale, and measure lengths and areas. */
export default function FloorplanMeasure() {
  useFonts()
  const [disp, setDisp] = useDisplay()
  const sysDark = useSystemDark()
  const dark = disp.theme === 'dark' || (disp.theme === 'auto' && sysDark)
  const hc = disp.contrast === 'high'

  const themeCfg = useMemo<ThemeConfig>(
    () => ({
      algorithm: dark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: {
        colorPrimary: hc ? (dark ? '#91caff' : '#003eb3') : PRIMARY,
        fontSize: disp.size,
        lineHeight: disp.lh,
        fontFamily: FONT_STACKS[disp.font],
        controlHeight: 44,
        controlHeightSM: 38,
        ...(hc
          ? {
              colorText: dark ? '#ffffff' : '#000000',
              colorTextSecondary: dark ? '#ffffff' : '#000000',
              colorTextTertiary: dark ? '#f0f0f0' : '#1f1f1f',
              colorTextDescription: dark ? '#f0f0f0' : '#1f1f1f',
              colorBorder: dark ? '#ffffff' : '#000000',
              colorBorderSecondary: dark ? '#d9d9d9' : '#262626',
              colorBgContainer: dark ? '#000000' : '#ffffff',
              colorBgLayout: dark ? '#000000' : '#ffffff',
              // Text on filled primary buttons: the high-contrast dark primary is light, so it needs dark text.
              colorTextLightSolid: dark ? '#000000' : '#ffffff',
            }
          : {}),
      },
    }),
    [dark, hc, disp.size, disp.lh, disp.font],
  )

  const engine = useRef<Engine | null>(null)
  if (!engine.current) engine.current = new Engine()
  useEffect(() => {
    engine.current!.setMark(disp.mark)
  }, [disp.mark])

  return (
    <ConfigProvider theme={themeCfg}>
      <AntApp>
        <Shell engine={engine.current} disp={disp} setDisp={setDisp} />
      </AntApp>
    </ConfigProvider>
  )
}
