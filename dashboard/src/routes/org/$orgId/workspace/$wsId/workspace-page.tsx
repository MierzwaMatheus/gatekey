import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useAuth } from '../../../../../lib/auth-context'
import { useLogout } from '../../../../../lib/use-logout'
import { WorkspaceLayout, type WorkspaceSection } from '../../../../../components/workspace/workspace-layout'
import { MembersList } from '../../../../../components/workspace/members-list'
import { AddMemberForm } from '../../../../../components/workspace/add-member-form'
import { RolesList } from '../../../../../components/workspace/roles-list'
import { CreateRoleForm } from '../../../../../components/workspace/create-role-form'
import { BindingsList } from '../../../../../components/workspace/bindings-list'
import { CreateBindingForm } from '../../../../../components/workspace/create-binding-form'
import { ResourceTypesList } from '../../../../../components/workspace/resource-types-list'
import { CreateResourceTypeForm } from '../../../../../components/workspace/create-resource-type-form'
import { AuditLogWorkspace } from '../../../../../components/workspace/audit-log-workspace'
import { PlaygroundPanel } from '../../../../../components/workspace/playground-panel'
import { LogOut, Plus } from 'lucide-react'

const SECTION_TITLES: Record<WorkspaceSection, string> = {
  members: 'Membros',
  roles: 'Roles',
  bindings: 'Bindings',
  'resource-types': 'Resource Types',
  'audit-log': 'Audit Log',
  playground: 'Playground',
}

export function WorkspacePage() {
  const { token } = useAuth()
  const { handleLogout, isLoggingOut } = useLogout()
  const { wsId, orgId } = useParams({ strict: false }) as { wsId: string; orgId: string }
  const [section, setSection] = useState<WorkspaceSection>('members')
  const [showAddMember, setShowAddMember] = useState(false)
  const [showCreateRole, setShowCreateRole] = useState(false)
  const [showCreateBinding, setShowCreateBinding] = useState(false)
  const [showCreateResourceType, setShowCreateResourceType] = useState(false)
  const [membersKey, setMembersKey] = useState(0)
  const [rolesKey, setRolesKey] = useState(0)
  const [bindingsKey, setBindingsKey] = useState(0)
  const [resourceTypesKey, setResourceTypesKey] = useState(0)

  const tok = token ?? ''

  function renderSection() {
    switch (section) {
      case 'members':
        return (
          <div className="space-y-6">
            <MembersList key={membersKey} token={tok} wsId={wsId} onAddMember={() => setShowAddMember(true)} />
            {showAddMember && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">Novo Membro</p>
                <AddMemberForm
                  token={tok}
                  wsId={wsId}
                  onSuccess={() => { setShowAddMember(false); setMembersKey((k) => k + 1) }}
                  onCancel={() => setShowAddMember(false)}
                />
              </div>
            )}
          </div>
        )

      case 'roles':
        return (
          <div className="space-y-6">
            <RolesList key={rolesKey} token={tok} wsId={wsId} />
            {showCreateRole && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">Novo Role</p>
                <CreateRoleForm
                  token={tok}
                  wsId={wsId}
                  onSuccess={() => { setShowCreateRole(false); setRolesKey((k) => k + 1) }}
                  onCancel={() => setShowCreateRole(false)}
                />
              </div>
            )}
          </div>
        )

      case 'bindings':
        return (
          <div className="space-y-6">
            <BindingsList key={bindingsKey} token={tok} wsId={wsId} />
            {showCreateBinding && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">Novo Binding</p>
                <CreateBindingForm
                  token={tok}
                  wsId={wsId}
                  onSuccess={() => { setShowCreateBinding(false); setBindingsKey((k) => k + 1) }}
                  onCancel={() => setShowCreateBinding(false)}
                />
              </div>
            )}
          </div>
        )

      case 'resource-types':
        return (
          <div className="space-y-6">
            <ResourceTypesList key={resourceTypesKey} token={tok} />
            {showCreateResourceType && (
              <div className="border-t border-border-default pt-6">
                <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-4">Novo Resource Type</p>
                <CreateResourceTypeForm
                  token={tok}
                  onSuccess={() => { setShowCreateResourceType(false); setResourceTypesKey((k) => k + 1) }}
                  onCancel={() => setShowCreateResourceType(false)}
                />
              </div>
            )}
          </div>
        )

      case 'audit-log':
        return <AuditLogWorkspace token={tok} wsId={wsId} />

      case 'playground':
        return <PlaygroundPanel token={tok} wsId={wsId} orgId={orgId ?? ''} />

      default:
        return null
    }
  }

  function renderActionButton() {
    if (section === 'members' && !showAddMember) {
      return (
        <button
          onClick={() => setShowAddMember(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} /> Novo membro
        </button>
      )
    }
    if (section === 'roles' && !showCreateRole) {
      return (
        <button
          onClick={() => setShowCreateRole(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} /> Novo role
        </button>
      )
    }
    if (section === 'bindings' && !showCreateBinding) {
      return (
        <button
          onClick={() => setShowCreateBinding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} /> Novo binding
        </button>
      )
    }
    if (section === 'resource-types' && !showCreateResourceType) {
      return (
        <button
          onClick={() => setShowCreateResourceType(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          <Plus size={13} /> Novo tipo
        </button>
      )
    }
    return null
  }

  return (
    <WorkspaceLayout activeSection={section} onSectionChange={setSection} wsId={wsId}>
      <div className="p-6 space-y-5">
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

        {renderSection()}
      </div>
    </WorkspaceLayout>
  )
}
