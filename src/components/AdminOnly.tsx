import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button } from 'antd'
import { useAuth } from '../auth/AuthProvider'
import { FullScreenLoader } from './FullScreenLoader'

/**
 * Shows its children to admins only. Hides pricing from the shop floor; it is
 * not a security boundary (the screen's code still ships to every browser).
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  if (!profile) return <FullScreenLoader />
  if (profile.role === 'admin') return <>{children}</>
  return (
    <div style={{ maxWidth: 520, margin: '48px auto', padding: '0 16px' }}>
      <Alert
        type="warning"
        showIcon
        title={t('tools.adminOnlyTitle')}
        description={t('tools.adminOnlyBody')}
        action={
          <Link to="/tools">
            <Button>{t('tools.title')}</Button>
          </Link>
        }
      />
    </div>
  )
}
