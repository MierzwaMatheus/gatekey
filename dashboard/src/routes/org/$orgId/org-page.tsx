import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useAuth } from '../../../lib/auth-context'
import { useLogout } from '../../../lib/use-logout'
import { OrgLayout, type OrgSection } from '../../../components/org/org-layout'
import { UsersList } from '../../../components/org/users-list'
import { CreateUserForm } from '../../../components/org/create-user-form'
import { WorkspacesList } from '../../../components/org/workspaces-list'
import { CreateWorkspaceForm } from '../../../components/org/create-workspace-form'
import { CapabilitiesListOrg } from '../../../components/org/capabilities-list-org'
import { ApiKeysList } from '../../../components/org/api-keys-list'
import { AuditLogOrg } from '../../../components/org/audit-log-org'
import { ColdStorageDownload } from '../../../components/org/cold-storage-download'
import { OrgSettings } from '../../../components/org/org-settings'
import { LogOut, Plus } from 'lucide-react'

const SECTION_TITLES: Record<OrgSection, string> = {
  users: 'Usuários',
  workspaces: 'Workspaces',
  capabilities: 'Capabilities',
  'api-keys': 'API Keys',
  'audit-log': 'Audit Log',
  'cold-storage': 'Cold Storage',
  settings: 'Configurações',
}

export function OrgPage() {
  const { token } = useAuth()
  const { handleLogout, isLoggingOut } = useLogout()
  const { orgId } = useParams({ strict: false }) as { orgId: string }
  const [section, setSection] = useState<OrgSection>('users')
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false)
  const [usersKey, setUsersKey] = useState(0)
  const [workspacesKey, setWorkspacesKey] = useState(0)

  const tok = token ?? ''

  function renderSection() {
    switch (section) {
      case 'users':
        return (
          <div className="space-y-6">
            <UsersList
              key={usersKey}
              token={tok}
              onAddUser={() => setShowCreateUser(true)}
            />
            {showCreateUser && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">
                  Novo Usuário
                </p>
                <div className="max-w-md">
                  <CreateUserForm
                    token={tok}
                    onSuccess={() => {
                      setShowCreateUser(false)
                      setUsersKey((k) => k + 1)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'workspaces':
        return (
          <div className="space-y-6">
            <WorkspacesList
              key={workspacesKey}
              token={tok}
              orgId={orgId}
              onAddWorkspace={() => setShowCreateWorkspace(true)}
            />
            {showCreateWorkspace && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">
                  Novo Workspace
                </p>
                <div className="max-w-md">
                  <CreateWorkspaceForm
                    token={tok}
                    onSuccess={() => {
                      setShowCreateWorkspace(false)
                      setWorkspacesKey((k) => k + 1)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )

      case 'capabilities':
        return <CapabilitiesListOrg token={tok} />

      case 'api-keys':
        return <ApiKeysList token={tok} />

      case 'audit-log':
        return <AuditLogOrg token={tok} orgId={orgId} />

      case 'cold-storage':
        return <ColdStorageDownload token={tok} orgId={orgId} />

      case 'settings':
        return <OrgSettings token={tok} orgId={orgId} />

      default:
        return null
    }
  }

  function renderActionButton() {
    if (section === 'users' && !showCreateUser) {
      return (
        <button
          onClick={() => setShowCreateUser(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} />
          Novo usuário
        </button>
      )
    }
    if (section === 'workspaces' && !showCreateWorkspace) {
      return (
        <button
          onClick={() => setShowCreateWorkspace(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} />
          Novo workspace
        </button>
      )
    }
    return null
  }

  return (
    <OrgLayout activeSection={section} onSectionChange={setSection} orgId={orgId}>
      <div className="p-6 space-y-5">
        {/* Page header */}
        <div className="flex items-center justify-between pb-4 border-b border-border-default">
          <h1 className="text-[18px] font-medium text-text-primary">
            {SECTION_TITLES[section]}
          </h1>
          <div className="flex items-center gap-2">
            {renderActionButton()}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer"
            >
              <LogOut size={13} />
              {isLoggingOut ? 'Saindo…' : 'Sair'}
            </button>
          </div>
        </div>

        {/* Section content */}
        {renderSection()}
      </div>
    </OrgLayout>
  )
}
