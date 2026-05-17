import { type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '../../lib/auth-context'
import { Icon, LogoMark } from '../ui/icons'
import { TopBar } from '../ui/topbar'
import { StatusBar } from '../ui/status-bar'

export type OrgSection =
  | 'users'
  | 'workspaces'
  | 'capabilities'
  | 'api-keys'
  | 'audit-log'
  | 'cold-storage'
  | 'settings'

interface NavDef {
  id: string
  label: string
  icon: string
  section: OrgSection
}

const NAV_ITEMS: NavDef[] = [
  { id: 'nav-users',        label: 'Usuários',      icon: 'users',        section: 'users' },
  { id: 'nav-workspaces',   label: 'Workspaces',    icon: 'layout-grid',  section: 'workspaces' },
  { id: 'nav-capabilities', label: 'Capabilities',  icon: 'zap',          section: 'capabilities' },
  { id: 'nav-api-keys',     label: 'API Keys',      icon: 'key',          section: 'api-keys' },
  { id: 'nav-audit-log',    label: 'Audit Log',     icon: 'audit',        section: 'audit-log' },
  { id: 'nav-cold-storage', label: 'Cold Storage',  icon: 'hard-drive',   section: 'cold-storage' },
  { id: 'nav-settings',     label: 'Configurações', icon: 'settings',     section: 'settings' },
]

const SECTION_LABELS: Record<OrgSection, string> = {
  'users':        'usuários',
  'workspaces':   'workspaces',
  'capabilities': 'capabilities',
  'api-keys':     'api.keys',
  'audit-log':    'audit.log',
  'cold-storage': 'cold.storage',
  'settings':     'configurações',
}

interface OrgLayoutProps {
  children: ReactNode
  activeSection?: OrgSection
  onSectionChange?: (section: OrgSection) => void
  orgId?: string
}

export function OrgLayout({ children, activeSection = 'users', onSectionChange, orgId }: OrgLayoutProps) {
  const { role } = useAuth()

  if (!role || role !== 'org_admin') {
    return <Navigate to="/login" />
  }

  const ctxLabel = orgId ? `org_${orgId.slice(-6)}` : 'org'

  return (
    <div className="app">
      <aside className="sidebar" data-testid="org-sidebar">
        <div className="sidebar-meta">
          <span>// gatekey.iam</span>
          <span>v2.4.1</span>
        </div>

        <div className="sidebar-head">
          <div className="brand">
            <LogoMark />
            <span className="brand-text">GateKey</span>
            <span className="brand-meta">ORG</span>
          </div>
          <div className="context-pill">
            <div className="ctx-tag">scope context</div>
            <div className="ctx-row">
              <span className="ctx-scope">org</span>
              <span className="ctx-sep">::</span>
              <span className="ctx-org">{ctxLabel}</span>
              <span className="ctx-dot" />
            </div>
          </div>
        </div>

        <div className="nav-section" data-testid="org-nav">
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
          <div className="user-chip">
            <div className="avatar">OA</div>
            <div className="user-meta">
              <div className="user-name">org_admin</div>
              <div className="user-sub">{ctxLabel}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <TopBar scope="org" context={ctxLabel} section={SECTION_LABELS[activeSection]} />
        <div className="content">
          {children}
        </div>
        <StatusBar tenant={ctxLabel} />
      </main>
    </div>
  )
}
