import { Alert, Button, Card, Col, Row, Typography } from 'antd'
import { FilePdfOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { formatInches } from '../lib/calculators/inches'
import { money } from '../lib/calculators/cushionPricing'
import { SHEET_L, SHEET_PRICE, SHEET_W, type planPlywood, type Sheet } from '../lib/calculators/plywoodNesting'

/** Plywood sheets for the job: count, cost and a layout of each 4 × 8 sheet. */
export function PlywoodSheets({ plan }: { plan: ReturnType<typeof planPlywood> }) {
  const { t } = useTranslation()
  return (
    <Card
      title={t('cushionPricing.plywoodTitle')}
      extra={
        plan.sheets.length > 0 && (
          <Button icon={<FilePdfOutlined />} onClick={() => void import('../lib/calculators/plywoodPdf').then((m) => m.downloadPlywoodPdf(plan))}>
            {t('cushionPricing.plywoodPdf')}
          </Button>
        )
      }
    >
      <Typography.Paragraph style={{ marginBottom: 8 }}>
        {t('cushionPricing.plywoodSummary', { sheets: plan.sheets.length, pieces: plan.pieces, price: money(SHEET_PRICE), cost: money(plan.cost) })}
      </Typography.Paragraph>
      {plan.tooBig.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          title={t('cushionPricing.plywoodTooBig')}
          description={
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {plan.tooBig.map((x) => (
                <li key={x.name}>
                  {x.name}: {formatInches(x.length)} × {formatInches(x.depth)}
                </li>
              ))}
            </ul>
          }
        />
      )}
      <Row gutter={[12, 12]}>
        {plan.sheets.map((sh, i) => (
          <Col xs={12} sm={6} key={i}>
            <SheetDiagram sheet={sh} n={i + 1} of={plan.sheets.length} />
          </Col>
        ))}
      </Row>
    </Card>
  )
}

function SheetDiagram({ sheet, n, of }: { sheet: Sheet; n: number; of: number }) {
  const { t } = useTranslation()
  return (
    <div>
      <Typography.Text strong style={{ fontSize: 12 }}>
        {t('cushionPricing.sheetN', { n, of, pct: Math.round(sheet.used * 100) })}
      </Typography.Text>
      <svg viewBox={`-1 -1 ${SHEET_W + 2} ${SHEET_L + 2}`} style={{ width: '100%', maxHeight: 220, display: 'block' }} role="img" aria-label={`Sheet ${n}`}>
        <rect x={0} y={0} width={SHEET_W} height={SHEET_L} fill="#eef0f3" stroke="#555" strokeWidth={0.5} />
        {sheet.pieces.map((p, k) => (
          <g key={k}>
            <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="#d4e3f2" stroke="#1677ff" strokeWidth={0.5} />
            <text
              x={p.x + p.w / 2}
              y={p.y + p.h / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={Math.max(2, Math.min(4, Math.min(p.w, p.h) / 4, Math.max(p.w, p.h) / 10))}
              fill="#222"
              transform={p.h > p.w ? `rotate(-90 ${p.x + p.w / 2} ${p.y + p.h / 2})` : undefined}
            >
              {formatInches(Math.max(p.w, p.h))} × {formatInches(Math.min(p.w, p.h))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
