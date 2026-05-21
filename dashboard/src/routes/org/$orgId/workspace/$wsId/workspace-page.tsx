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
import { EffectiveAccessView } from '../../../../../components/workspace/effective-access-view'
import { LogOut, Plus } from 'lucide-react'
import { PageHeader } from '../../../../../components/ui/page-header'

const SECTION_META: Record<WorkspaceSection, { number: string; title: string; module: string; submodule: string; description: string }> = {
  members: {
    number: '01', title: 'Membros', module: 'MEMBERS', submodule: 'LIST',
    description: 'Membros com acesso a este workspace. Gerencie associações de usuário e papéis.',
  },
  roles: {
    number: '02', title: 'Roles', module: 'ROLES', submodule: 'LIST',
    description: 'Papéis definidos neste workspace. Cada papel agrupa um conjunto de capabilities.',
  },
  bindings: {
    number: '03', title: 'Bindings', module: 'BINDINGS', submodule: 'LIST',
    description: 'Vínculos entre membros e papéis no workspace. Definem o que cada usuário pode fazer.',
  },
  'resource-types': {
    number: '04', title: 'Resource Types', module: 'RESOURCES', submodule: 'TYPES',
    description: 'Tipos de recurso registrados neste workspace para controle de acesso.',
  },
  'audit-log': {
    number: '05', title: 'Audit Log', module: 'AUDIT', submodule: 'LOG',
    description: 'Registro de operações realizadas no contexto deste workspace.',
  },
  playground: {
    number: '06', title: 'Playground', module: 'PLAYGROUND', submodule: 'REPL',
    description: 'Ambiente de teste para avaliação de políticas de acesso em tempo real.',
  },
  'effective-access': {
    number: '07', title: 'Acesso Efetivo', module: 'ACCESS', submodule: 'EFFECTIVE',
    description: 'Visão consolidada do acesso efetivo de um usuário: workspace, recursos diretos e herdados.',
  },
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
            <BindingsList token={tok} orgId={orgId} wsId={wsId} />
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
        return <AuditLogWorkspace token={tok} orgId={orgId ?? ''} wsId={wsId} />

      case 'playground':
        return <PlaygroundPanel token={tok} wsId={wsId} orgId={orgId ?? ''} />

      case 'effective-access':
        return <EffectiveAccessView token={tok} wsId={wsId} />

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
        <PageHeader
          {...SECTION_META[section]}
          scope="WORKSPACE"
          context={`ws_${wsId.slice(-6)}`}
          tenant={wsId.slice(-8)}
          caller="ws_admin@gatekey"
          actions={
            <>
              {renderActionButton()}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer"
              >
                <LogOut size={13} />
                {isLoggingOut ? 'Saindo…' : 'Sair'}
              </button>
            </>
          }
        />

        {renderSection()}
      </div>
    </WorkspaceLayout>
  )
}
