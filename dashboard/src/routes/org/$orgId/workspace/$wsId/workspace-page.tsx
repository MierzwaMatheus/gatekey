import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useAuth } from '../../../../../lib/auth-context'
import { useLogout } from '../../../../../lib/use-logout'
import { WorkspaceLayout, type WorkspaceSection } from '../../../../../components/workspace/workspace-layout'
import { LogOut } from 'lucide-react'

const SECTION_TITLES: Record<WorkspaceSection, string> = {
  members: 'Membros',
  roles: 'Roles',
  bindings: 'Bindings',
  'resource-types': 'Resource Types',
  'audit-log': 'Audit Log',
}

export function WorkspacePage() {
  const { token } = useAuth()
  const { handleLogout, isLoggingOut } = useLogout()
  const { wsId } = useParams({ strict: false }) as { wsId: string }
  const [section, setSection] = useState<WorkspaceSection>('members')

  const tok = token ?? ''
  void tok

  return (
    <WorkspaceLayout activeSection={section} onSectionChange={setSection} wsId={wsId}>
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between pb-4 border-b border-border-default">
          <h1 className="text-[18px] font-medium text-text-primary">
            {SECTION_TITLES[section]}
          </h1>
          <div className="flex items-center gap-2">
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

        <div data-testid={`workspace-section-${section}`}>
          {/* Sections will be rendered here in subsequent cycles */}
          <p className="text-text-muted text-sm">Carregando {SECTION_TITLES[section]}…</p>
        </div>
      </div>
    </WorkspaceLayout>
  )
}
