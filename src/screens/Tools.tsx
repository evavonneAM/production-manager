import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, Card, Col, Divider, Empty, Input, Row, Tag, Typography, theme } from 'antd'
import { ExportOutlined } from '@ant-design/icons'
import { TOOLS, TOOL_GROUPS, type Tool } from '../lib/tools'

function ToolIcon({ tool, color }: { tool: Tool; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
      aria-hidden
    >
      {tool.icon}
    </svg>
  )
}

/** Tools homepage: every workroom calculator in one place. */
export default function Tools() {
  const { t } = useTranslation()
  const { token } = theme.useToken()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (tool: Tool) =>
      !q ||
      [tool.keywords, t(`tools.items.${tool.id}.name`), t(`tools.items.${tool.id}.desc`)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    return TOOL_GROUPS.map((group) => ({
      group,
      tools: TOOLS.filter((tool) => tool.group === group && match(tool)),
    })).filter((g) => g.tools.length > 0)
  }, [query, t])

  return (
    <div style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
      <Typography.Title level={3} style={{ marginBottom: 4 }}>
        {t('tools.title')}
      </Typography.Title>
      <Typography.Text type="secondary">{t('tools.subtitle')}</Typography.Text>

      <Input.Search
        size="large"
        allowClear
        placeholder={t('tools.search')}
        aria-label={t('tools.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginTop: 20 }}
      />

      {groups.length === 0 && <Empty description={t('tools.noMatch')} style={{ marginTop: 48 }} />}

      {groups.map(({ group, tools }) => (
        <section key={group}>
          <Divider titlePlacement="start" style={{ marginTop: 28 }}>
            {t(`tools.groups.${group}`)}
          </Divider>
          <Row gutter={[12, 12]}>
            {tools.map((tool) => {
              const live = !!(tool.route || tool.url)
              const card = (
                <Card
                  hoverable={live}
                  style={{ height: '100%', opacity: live ? 1 : 0.75 }}
                  styles={{ body: { padding: 16 } }}
                >
                  <Card.Meta
                    avatar={
                      <Avatar
                        shape="square"
                        size={44}
                        style={{ background: token.colorPrimaryBg }}
                        icon={<ToolIcon tool={tool} color={token.colorPrimary} />}
                      />
                    }
                    title={
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {t(`tools.items.${tool.id}.name`)}
                        {tool.route ? null : live ? (
                          <ExportOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                        ) : (
                          <Tag color="warning" style={{ marginInlineEnd: 0 }}>
                            {t('tools.notPublished')}
                          </Tag>
                        )}
                      </span>
                    }
                    description={t(`tools.items.${tool.id}.desc`)}
                  />
                </Card>
              )
              return (
                <Col key={tool.id} xs={24} sm={12}>
                  {tool.route ? (
                    <Link to={tool.route} style={{ display: 'block', height: '100%' }}>
                      {card}
                    </Link>
                  ) : live ? (
                    <a href={tool.url!} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: '100%' }}>
                      {card}
                    </a>
                  ) : (
                    card
                  )}
                </Col>
              )
            })}
          </Row>
        </section>
      ))}
    </div>
  )
}
