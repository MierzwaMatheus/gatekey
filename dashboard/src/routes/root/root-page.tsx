import { useState } from 'react'
import { useAuth } from '../../lib/auth-context'
import { useLogout } from '../../lib/use-logout'
import { RootLayout, type RootSection } from '../../components/root/root-layout'
import { OrgsList } from '../../components/root/orgs-list'
import { CreateOrgForm } from '../../components/root/create-org-form'
import { OrgQuotaSettings } from '../../components/root/org-quota-settings'
import { SessionsList } from '../../components/root/sessions-list'
import { AuditLogTable } from '../../components/root/audit-log-table'
import { CapabilitiesList } from '../../components/root/capabilities-list'
import { ApiKeysBrowser } from '../../components/root/api-keys-browser'
import { ColdStorageConfig } from '../../components/root/cold-storage-config'
import { LogOut } from 'lucide-react'

const SECTION_TITLES: Record<RootSection, string> = {
  orgs: 'Organizações',
  sessions: 'Sessões Ativas',
  'audit-log': 'Audit Log',
  capabilities: 'Capabilities',
  'api-keys': 'API Keys',
  quotas: 'Configurar Cotas',
  'cold-storage': 'Cold Storage',
}

export function RootPage() {
  const { token } = useAuth()
  const { handleLogout, isLoggingOut } = useLogout()
  const [section, setSection] = useState<RootSection>('orgs')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  const tok = token ?? ''

  function renderSection() {
    switch (section) {
      case 'orgs':
        return (
          <div className="space-y-6">
            <OrgsList token={tok} onSelectOrg={setSelectedOrgId} />
            <div className="border-t border-border-default pt-6">
              <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">
                Nova Organização
              </p>
              <div className="max-w-md">
                <CreateOrgForm token={tok} onSuccess={() => {}} />
              </div>
            </div>
          </div>
        )
      case 'sessions':
        return <SessionsList token={tok} />
      case 'audit-log':
        return <AuditLogTable token={tok} />
      case 'capabilities':
        return <CapabilitiesList token={tok} />
      case 'api-keys':
        return <ApiKeysBrowser token={tok} />
      case 'quotas':
        return selectedOrgId ? (
          <OrgQuotaSettings token={tok} orgId={selectedOrgId} />
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-text-secondary">
              Selecione uma organização na aba Organizações para configurar suas cotas.
            </p>
          </div>
        )
      case 'cold-storage':
        return <ColdStorageConfig />
      default:
        return null
    }
  }

  return (
    <RootLayout activeSection={section} onSectionChange={setSection}>
      <div className="p-6 space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-default">
          <h1 className="text-[18px] font-medium text-text-primary">
            {SECTION_TITLES[section]}
          </h1>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer"
          >
            <LogOut size={13} />
            {isLoggingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>

        {/* Section content */}
        {renderSection()}
      </div>
    </RootLayout>
  )
}
