import { type ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import {
  Users,
  LayoutGrid,
  Zap,
  KeyRound,
  ScrollText,
  HardDrive,
  Settings,
} from 'lucide-react'
import { useAuth } from '../../lib/auth-context'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  section: OrgSection
}

export type OrgSection =
  | 'users'
  | 'workspaces'
  | 'capabilities'
  | 'api-keys'
  | 'audit-log'
  | 'cold-storage'
  | 'settings'

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-users', label: 'Usuários', icon: Users, section: 'users' },
  { id: 'nav-workspaces', label: 'Workspaces', icon: LayoutGrid, section: 'workspaces' },
  { id: 'nav-capabilities', label: 'Capabilities', icon: Zap, section: 'capabilities' },
  { id: 'nav-api-keys', label: 'API Keys', icon: KeyRound, section: 'api-keys' },
  { id: 'nav-audit-log', label: 'Audit Log', icon: ScrollText, section: 'audit-log' },
  { id: 'nav-cold-storage', label: 'Cold Storage', icon: HardDrive, section: 'cold-storage' },
  { id: 'nav-settings', label: 'Configurações', icon: Settings, section: 'settings' },
]

function CircuitTexture() {
  return (
    <svg
      data-testid="circuit-texture"
      xmlns="http://www.w3.org/2000/svg"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.035, zIndex: 0 }}
      aria-hidden="true"
    >
      <defs>
        <pattern id="circuit-org" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="2" fill="#C9D1D9" />
          <circle cx="28" cy="4" r="2" fill="#C9D1D9" />
          <circle cx="4" cy="32" r="2" fill="#C9D1D9" />
          <circle cx="44" cy="20" r="2" fill="#C9D1D9" />
          <circle cx="16" cy="44" r="2" fill="#C9D1D9" />
          <line x1="4" y1="4" x2="28" y2="4" stroke="#C9D1D9" strokeWidth="1" />
          <line x1="28" y1="4" x2="44" y2="20" stroke="#C9D1D9" strokeWidth="1" />
          <line x1="4" y1="4" x2="4" y2="32" stroke="#C9D1D9" strokeWidth="1" />
          <line x1="4" y1="32" x2="16" y2="44" stroke="#C9D1D9" strokeWidth="1" />
          <line x1="44" y1="20" x2="16" y2="44" stroke="#C9D1D9" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#circuit-org)" />
    </svg>
  )
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

  return (
    <div className="min-h-screen bg-surface-page flex relative">
      <CircuitTexture />

      {/* Sidebar */}
      <aside
        data-testid="org-sidebar"
        className="w-[220px] min-h-screen bg-surface-card border-r border-border-default flex flex-col flex-shrink-0 relative z-10"
      >
        {/* Header */}
        <div className="px-5 py-5 border-b border-border-default">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
                <polygon
                  points="12,2 20,6 20,18 12,22 4,18 4,6"
                  stroke="#F0A500"
                  strokeWidth="1.5"
                  fill="none"
                />
                <line x1="9" y1="12" x2="15" y2="12" stroke="#F0A500" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary leading-none">GateKey</p>
              <p className="text-xs text-text-secondary font-mono mt-0.5">
                {orgId ? `org_${orgId.slice(-6)}` : 'Org Admin'}
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-3 px-2" data-testid="org-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon, section }) => {
            const isActive = activeSection === section
            return (
              <button
                key={id}
                data-testid={id}
                onClick={() => onSectionChange?.(section)}
                className={[
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-left text-sm transition-colors cursor-pointer mb-0.5',
                  isActive
                    ? 'bg-surface-elevated text-text-primary border-l-2 border-accent-primary pl-[10px]'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary border-l-2 border-transparent pl-[10px]',
                ].join(' ')}
              >
                <Icon size={16} className={isActive ? 'text-accent-primary' : 'text-text-secondary'} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 relative z-10 overflow-auto">
        {children}
      </main>
    </div>
  )
}
