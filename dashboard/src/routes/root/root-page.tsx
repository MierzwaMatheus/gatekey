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
import { LogOut, Copy, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/page-header'

const SECTION_META: Record<RootSection, { number: string; title: string; module: string; submodule: string; description: string }> = {
  orgs: {
    number: '01', title: 'Organizações', module: 'ORGS', submodule: 'LIST',
    description: 'Organizações cadastradas no sistema. Gerencie tenants, crie novas orgs e configure cotas.',
  },
  sessions: {
    number: '02', title: 'Sessões Ativas', module: 'SESSIONS', submodule: 'ACTIVE',
    description: 'Tokens emitidos e atualmente válidos no escopo root. Inclui sessões de usuário e tokens de serviço de longa duração. Polling ativo a cada 5s.',
  },
  'audit-log': {
    number: '03', title: 'Audit Log', module: 'AUDIT', submodule: 'LOG',
    description: 'Registro imutável de todas as operações realizadas no sistema. Filtro por ator, recurso e resultado.',
  },
  capabilities: {
    number: '04', title: 'Capabilities', module: 'CAPABILITIES', submodule: 'LIST',
    description: 'Permissões globais disponíveis para atribuição em workspaces.',
  },
  'api-keys': {
    number: '05', title: 'API Keys', module: 'API-KEYS', submodule: 'BROWSER',
    description: 'Chaves de API emitidas no escopo root. Visualize escopo, expiração e último uso.',
  },
  quotas: {
    number: '06', title: 'Configurar Cotas', module: 'QUOTAS', submodule: 'CONFIG',
    description: 'Configuração de limites de recursos por organização.',
  },
  'cold-storage': {
    number: '07', title: 'Cold Storage', module: 'STORAGE', submodule: 'COLD',
    description: 'Configuração de armazenamento frio para audit logs e dados históricos.',
  },
}

interface TempPasswordModal {
  orgId: string
  tempPassword: string
}

function TempPasswordDialog({ orgId, tempPassword, onClose }: TempPasswordModal & { onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="temp-pass-title"
        className="w-full max-w-md bg-surface-card rounded-card shadow-card border border-border-default p-6 mx-4"
      >
        <h2 id="temp-pass-title" className="text-base font-medium text-text-primary mb-1">
          Organização criada
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          O admin ainda não tem senha definida. Anote a senha temporária abaixo e repasse por canal seguro — ela não será exibida novamente.
        </p>

        <div className="flex items-center gap-2 bg-surface-elevated border border-border-default rounded-input px-3 py-2 mb-2">
          <code className="flex-1 font-mono text-sm text-accent-primary tracking-wider select-all">
            {tempPassword}
          </code>
          <button
            onClick={handleCopy}
            className="text-text-secondary hover:text-text-primary transition-colors"
            title="Copiar senha"
          >
            {copied ? <Check size={15} className="text-status-allow" /> : <Copy size={15} />}
          </button>
        </div>

        <p className="text-xs text-text-muted mb-5">
          Org ID: <span className="font-mono">{orgId}</span>
        </p>

        <button
          data-testid="btn-confirm-temp-password"
          onClick={onClose}
          className="w-full bg-accent-primary text-black font-medium rounded-button py-2 text-sm hover:bg-accent-hover transition-colors"
        >
          Entendi, já copiei a senha
        </button>
      </div>
    </div>
  )
}

export function RootPage() {
  const { token } = useAuth()
  const { handleLogout, isLoggingOut } = useLogout()
  const [section, setSection] = useState<RootSection>('orgs')
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [tempPasswordModal, setTempPasswordModal] = useState<TempPasswordModal | null>(null)
  const [orgsRefreshKey, setOrgsRefreshKey] = useState(0)

  const tok = token ?? ''

  function renderSection() {
    switch (section) {
      case 'orgs':
        return (
          <div className="space-y-6">
            <OrgsList token={tok} onSelectOrg={setSelectedOrgId} refreshKey={orgsRefreshKey} />
            <div className="border-t border-border-default pt-6">
              <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">
                Nova Organização
              </p>
              <div className="max-w-md">
                <CreateOrgForm
                  token={tok}
                  onSuccess={(orgId, tempPassword) => {
                    setOrgsRefreshKey((k) => k + 1)
                    if (tempPassword) {
                      setTempPasswordModal({ orgId, tempPassword })
                    }
                  }}
                />
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
    <>
    {tempPasswordModal && (
      <TempPasswordDialog
        orgId={tempPasswordModal.orgId}
        tempPassword={tempPasswordModal.tempPassword}
        onClose={() => setTempPasswordModal(null)}
      />
    )}
    <RootLayout activeSection={section} onSectionChange={setSection}>
      <div className="p-6 space-y-5">
        <PageHeader
          {...SECTION_META[section]}
          scope="ROOT"
          context="root"
          tenant="root"
          caller="root@gatekey"
          actions={
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer"
            >
              <LogOut size={13} />
              {isLoggingOut ? 'Saindo…' : 'Sair'}
            </button>
          }
        />

        {/* Section content */}
        {renderSection()}
      </div>
    </RootLayout>
    </>
  )
}
