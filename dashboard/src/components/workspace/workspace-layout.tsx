import { type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '../../lib/auth-context'
import { Icon, LogoMark } from '../ui/icons'
import { TopBar } from '../ui/topbar'
import { StatusBar } from '../ui/status-bar'

export type WorkspaceSection =
  | 'members'
  | 'roles'
  | 'bindings'
  | 'resource-types'
  | 'audit-log'
  | 'playground'

interface NavDef {
  id: string
  label: string
  icon: string
  section: WorkspaceSection
}

const NAV_ITEMS: NavDef[] = [
  { id: 'nav-members',        label: 'Membros',         icon: 'users',    section: 'members' },
  { id: 'nav-roles',          label: 'Roles',           icon: 'roles',    section: 'roles' },
  { id: 'nav-bindings',       label: 'Bindings',        icon: 'link2',    section: 'bindings' },
  { id: 'nav-resource-types', label: 'Resource Types',  icon: 'layers',   section: 'resource-types' },
  { id: 'nav-audit-log',      label: 'Audit Log',       icon: 'audit',    section: 'audit-log' },
  { id: 'nav-playground',     label: 'Playground',      icon: 'terminal', section: 'playground' },
]

const SECTION_LABELS: Record<WorkspaceSection, string> = {
  'members':        'membros',
  'roles':          'roles',
  'bindings':       'bindings',
  'resource-types': 'resource.types',
  'audit-log':      'audit.log',
  'playground':     'playground',
}

const ALLOWED_ROLES = new Set(['root', 'org_admin', 'workspace_admin'])

interface WorkspaceLayoutProps {
  children: ReactNode
  activeSection?: WorkspaceSection
  onSectionChange?: (section: WorkspaceSection) => void
  wsId?: string
}

export function WorkspaceLayout({
  children,
  activeSection = 'members',
  onSectionChange,
  wsId,
}: WorkspaceLayoutProps) {
  const { role } = useAuth()

  if (!role || !ALLOWED_ROLES.has(role)) {
    return <Navigate to="/login" />
  }

  const ctxLabel = wsId ? `ws_${wsId.slice(-6)}` : 'workspace'

  return (
    <div className="app">
      <aside className="sidebar w-[220px]" data-testid="workspace-sidebar">
        <div className="sidebar-meta">
          <span>// gatekey.iam</span>
          <span>v2.4.1</span>
        </div>

        <div className="sidebar-head">
          <div className="brand">
            <LogoMark />
            <span className="brand-text">GateKey</span>
            <span className="brand-meta">WS</span>
          </div>
          <div className="context-pill">
            <div className="ctx-tag">scope context</div>
            <div className="ctx-row">
              <span className="ctx-scope">ws</span>
              <span className="ctx-sep">::</span>
              <span className="ctx-org">{ctxLabel}</span>
              <span className="ctx-dot" />
            </div>
          </div>
        </div>

        <div className="nav-section" data-testid="workspace-nav">
          <div className="nav-section-label">/ workspace</div>
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
            <div className="avatar">WA</div>
            <div className="user-meta">
              <div className="user-name">admin</div>
              <div className="user-sub">{wsId ?? 'workspace'}</div>
            </div>
          </div>
        </div>
      </aside>

      <div data-testid="circuit-texture" className="circuit-texture" />

      <main className="main">
        <TopBar scope="ws" context={ctxLabel} section={SECTION_LABELS[activeSection]} />
        <div className="content">
          {children}
        </div>
        <StatusBar tenant={ctxLabel} />
      </main>
    </div>
  )
}
