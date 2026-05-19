import { type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
import { useAuth } from '../../lib/auth-context'
import { Icon, LogoMark } from '../ui/icons'
import { TopBar } from '../ui/topbar'
import { StatusBar } from '../ui/status-bar'

export type RootSection =
  | 'orgs'
  | 'sessions'
  | 'audit-log'
  | 'capabilities'
  | 'api-keys'
  | 'quotas'
  | 'cold-storage'
  | 'security'

interface NavDef {
  id: string
  labelKey: string
  icon: string
  section: RootSection
}

const NAV_DEFS = [
  { id: 'nav-orgs',         labelKey: 'nav.orgs',         icon: 'orgs',       section: 'orgs' as RootSection },
  { id: 'nav-sessions',     labelKey: 'nav.sessions',     icon: 'sessions',   section: 'sessions' as RootSection },
  { id: 'nav-audit-log',    labelKey: 'nav.audit_log',    icon: 'audit',      section: 'audit-log' as RootSection },
  { id: 'nav-capabilities', labelKey: 'nav.capabilities', icon: 'zap',        section: 'capabilities' as RootSection },
  { id: 'nav-api-keys',     labelKey: 'nav.api_keys',     icon: 'key',        section: 'api-keys' as RootSection },
  { id: 'nav-quotas',       labelKey: 'nav.quotas',       icon: 'sliders',    section: 'quotas' as RootSection },
  { id: 'nav-cold-storage', labelKey: 'nav.cold_storage', icon: 'hard-drive', section: 'cold-storage' as RootSection },
  { id: 'nav-security',     labelKey: 'nav.security',     icon: 'shield',     section: 'security' as RootSection },
]

interface RootLayoutProps {
  children: ReactNode
  activeSection?: RootSection
  onSectionChange?: (section: RootSection) => void
}

export function RootLayout({ children, activeSection = 'orgs', onSectionChange }: RootLayoutProps) {
  const { t } = useTranslation('common')
  const { role } = useAuth()
  const coldStorageAlert = useQuery(api.auditLog.checkColdStorageAlert)

  if (!role || role !== 'root') {
    return <Navigate to="/login" />
  }

  return (
    <div className="app">
      <aside className="sidebar w-[220px]" data-testid="root-sidebar">
        <div className="sidebar-meta">
          <span>// gatekey.iam</span>
          <span>v2.4.1</span>
        </div>

        <div className="sidebar-head">
          <div className="brand">
            <LogoMark />
            <span className="brand-text">GateKey</span>
            <span className="brand-meta">Root</span>
          </div>
          <div className="context-pill">
            <div className="ctx-tag">scope context</div>
            <div className="ctx-row">
              <span className="ctx-scope">root</span>
              <span className="ctx-sep">::</span>
              <span className="ctx-org">global</span>
              <span className="ctx-dot" />
            </div>
          </div>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">{t('nav.admin')}</div>
          {NAV_DEFS.map((it, idx) => {
            const isActive = activeSection === it.section
            return (
              <button
                key={it.id}
                data-testid={it.id}
                onClick={() => onSectionChange?.(it.section)}
                className={`nav-item border-l-2 ${isActive ? 'border-accent-primary text-text-primary' : 'border-transparent text-text-secondary'}`}
                data-active={isActive}
              >
                <span className="nav-num">{String(idx + 1).padStart(2, '0')}</span>
                <Icon name={it.icon} size={14} />
                <span className="nav-label">{t(it.labelKey)}</span>
              </button>
            )
          })}
        </div>

        <div className="sidebar-foot">
          <button
            className="nav-item"
            data-active={false}
            data-testid="nav-settings"
          >
            <span className="nav-num">{String(NAV_DEFS.length + 1).padStart(2, '0')}</span>
            <Icon name="settings" size={14} />
            <span className="nav-label">{t('nav.settings')}</span>
          </button>
          <div className="user-chip">
            <div className="avatar">RD</div>
            <div className="user-meta">
              <div className="user-name">root@gatekey</div>
              <div className="user-sub">node · sa-east-1a</div>
            </div>
          </div>
        </div>
      </aside>

      <div data-testid="circuit-texture" className="circuit-texture" />

      <main className="main">
        <TopBar scope="root" context="global" section={t(`nav.${activeSection.replace(/-/g, '_')}`)} />
        {coldStorageAlert?.shouldAlert && (
          <div
            data-testid="cold-storage-alert"
            className="mx-6 mt-4 flex items-center gap-3 rounded border border-[var(--gate-danger)] bg-[var(--gate-danger)]/10 px-4 py-3 text-sm text-[var(--gate-danger)]"
          >
            <Icon name="alert-triangle" size={16} />
            <span>{t('cold_storage.alert_message')}</span>
            <button
              className="ml-auto text-xs underline opacity-70 hover:opacity-100"
              onClick={() => onSectionChange?.('cold-storage')}
            >
              {t('cold_storage.configure')}
            </button>
          </div>
        )}
        <div className="content">
          {children}
        </div>
        <StatusBar tenant="root" />
      </main>
    </div>
  )
}
