import { Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { formatInches } from '../lib/calculators/inches'
import type { FabricPlan, PlacedCut } from '../lib/calculators/fabricNesting'

const FILLS = ['#d4e3f2', '#f6e3c8', '#d9eedb', '#eedcf2', '#f5d6d6', '#d6eff0', '#ece9cf', '#e2e2e2']
const STROKES = ['#1677ff', '#d48806', '#389e0d', '#9254de', '#cf1322', '#08979c', '#7c6f00', '#595959']

/** Down-the-nap arrow in a piece's corner. Every piece points the same way along the roll. */
function NapArrow({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const len = Math.min(6, w * 0.5)
  const s = Math.min(1.2, h / 4)
  const ax = x + 1
  const ay = y + Math.min(2, h / 2)
  return (
    <g stroke="#a8071a" fill="#a8071a" strokeWidth={0.35}>
      <line x1={ax} y1={ay} x2={ax + len - s} y2={ay} />
      <polygon points={`${ax + len},${ay} ${ax + len - s},${ay - s / 2} ${ax + len - s},${ay + s / 2}`} stroke="none" />
    </g>
  )
}

/** The roll unrolled on the cutting table: first end on the left, the roll's width top to bottom. */
export function RollDiagram({
  plan,
  cushionIndex,
  pieceLabel,
}: {
  plan: FabricPlan
  cushionIndex: (c: string) => number
  pieceLabel: (p: PlacedCut) => string
}) {
  const { t } = useTranslation()
  const W = plan.width
  const L = plan.totalLength
  const PX = 4 // pixels per inch on screen
  const off = plan.endAllowance
  const cordX = off + plan.piecesLength
  const yards = Math.floor(L / 36 + 1e-9)
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('fabricYardage.diagram')}
      </Typography.Text>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          background: '#fafafa',
          marginTop: 4,
        }}
      >
        <svg
          width={(L + 2) * PX}
          height={(W + 8) * PX}
          viewBox={`-1 -6 ${L + 2} ${W + 8}`}
          role="img"
          aria-label={t('fabricYardage.diagram')}
          style={{ display: 'block' }}
        >
          <rect x={0} y={0} width={L} height={W} fill="#fff" stroke="#555" strokeWidth={0.4} />
          {off > 0 && (
            <g>
              <rect x={0} y={0} width={off} height={W} fill="#e8e8e8" />
              <text
                x={off / 2}
                y={W / 2}
                fontSize={1.6}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#666"
                transform={`rotate(-90 ${off / 2} ${W / 2})`}
              >
                {t('fabricYardage.firstEnd')}
              </text>
            </g>
          )}
          {plan.placed.map((p, k) => {
            const ci = (p.cushion ? cushionIndex(p.cushion) : FILLS.length - 1) % FILLS.length
            const x = off + p.y
            const y = p.x
            // On screen the roll runs left to right, so a piece's length along the roll is its width here.
            const w = p.h
            const h = p.w
            const fs = Math.max(1.2, Math.min(3, Math.min(w, h) / 3.2, Math.max(w, h) / 11))
            const vertical = h > w * 1.4
            const cx = x + w / 2
            const cy = y + h / 2
            return (
              <g key={k}>
                <rect x={x} y={y} width={w} height={h} fill={FILLS[ci]} stroke={STROKES[ci]} strokeWidth={0.3} />
                <text x={cx} y={cy} fontSize={fs} textAnchor="middle" fill="#222" transform={vertical ? `rotate(-90 ${cx} ${cy})` : undefined}>
                  <tspan x={cx} dy={-fs * 0.2}>
                    {pieceLabel(p)}
                  </tspan>
                  <tspan x={cx} dy={fs * 1.1}>
                    {formatInches(p.across)} × {formatInches(p.along)}
                  </tspan>
                </text>
                {plan.oneWay && <NapArrow x={x} y={y} w={w} h={h} />}
                {p.matched && <circle cx={cx} cy={cy} r={Math.min(1.6, w / 4, h / 4)} fill="none" stroke="#c0392b" strokeWidth={0.35} />}
              </g>
            )
          })}
          {plan.cordingLength > 0 && (
            <g>
              <rect x={cordX} y={0} width={plan.cordingLength} height={W} fill="#fff7e6" stroke="#d48806" strokeWidth={0.3} strokeDasharray="1 0.6" />
              <text
                x={cordX + plan.cordingLength / 2}
                y={W / 2}
                fontSize={2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#874d00"
                transform={`rotate(-90 ${cordX + plan.cordingLength / 2} ${W / 2})`}
              >
                {t('fabricYardage.cordingBlock')}
              </text>
            </g>
          )}
          {Array.from({ length: yards }, (_, i) => (i + 1) * 36).map((x) => (
            <g key={x}>
              <line x1={x} y1={-1.5} x2={x} y2={W} stroke="#ff4d4f" strokeWidth={0.25} strokeDasharray="0.8 0.8" />
              <text x={x} y={-2.4} fontSize={2.2} textAnchor="middle" fill="#cf1322">
                {t('fabricYardage.yd', { n: x / 36 })}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
