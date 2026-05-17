import { type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
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

interface NavDef {
  id: string
  label: string
  icon: string
  section: RootSection
}

const NAV_ITEMS: NavDef[] = [
  { id: 'nav-orgs',         label: 'Organizações',  icon: 'orgs',       section: 'orgs' },
  { id: 'nav-sessions',     label: 'Sessões Ativas', icon: 'sessions',   section: 'sessions' },
  { id: 'nav-audit-log',    label: 'Audit Log',      icon: 'audit',      section: 'audit-log' },
  { id: 'nav-capabilities', label: 'Capabilities',   icon: 'zap',        section: 'capabilities' },
  { id: 'nav-api-keys',     label: 'API Keys',       icon: 'key',        section: 'api-keys' },
  { id: 'nav-quotas',       label: 'Cotas',          icon: 'sliders',    section: 'quotas' },
  { id: 'nav-cold-storage', label: 'Cold Storage',   icon: 'hard-drive', section: 'cold-storage' },
]

const SECTION_LABELS: Record<RootSection, string> = {
  'orgs':         'organizações',
  'sessions':     'sessions.active',
  'audit-log':    'audit.log',
  'capabilities': 'capabilities',
  'api-keys':     'api.keys',
  'quotas':       'cotas',
  'cold-storage': 'cold.storage',
}

interface RootLayoutProps {
  children: ReactNode
  activeSection?: RootSection
  onSectionChange?: (section: RootSection) => void
}

export function RootLayout({ children, activeSection = 'orgs', onSectionChange }: RootLayoutProps) {
  const { role } = useAuth()

  if (!role || role !== 'root') {
    return <Navigate to="/login" />
  }

  return (
    <div className="app">
      <aside className="sidebar" data-testid="root-sidebar">
        <div className="sidebar-meta">
          <span>// gatekey.iam</span>
          <span>v2.4.1</span>
        </div>

        <div className="sidebar-head">
          <div className="brand">
            <LogoMark />
            <span className="brand-text">GateKey</span>
            <span className="brand-meta">CTRL</span>
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
          <div className="nav-section-label">/ administração</div>
          {NAV_ITEMS.map((it, idx) => {
            const isActive = activeSection === it.section
            return (
              <button
                key={it.id}
                data-testid={it.id}
                onClick={() => onSectionChange?.(it.section)}
                className="nav-item"
                data-active={isActive}
              >
                <span className="nav-num">{String(idx + 1).padStart(2, '0')}</span>
                <Icon name={it.icon} size={14} />
                <span className="nav-label">{it.label}</span>
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
            <span className="nav-num">{String(NAV_ITEMS.length + 1).padStart(2, '0')}</span>
            <Icon name="settings" size={14} />
            <span className="nav-label">Configurações</span>
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

      <main className="main">
        <TopBar scope="root" context="global" section={SECTION_LABELS[activeSection]} />
        <div className="content">
          {children}
        </div>
        <StatusBar tenant="root" />
      </main>
    </div>
  )
}
