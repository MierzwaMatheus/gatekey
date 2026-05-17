import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { listOrgs, type OrgSummary } from '../../lib/root-api'

interface OrgsListProps {
  token: string
  onSelectOrg: (orgId: string) => void
  refreshKey?: number
}

function StatusPill({ status, orgId }: { status: OrgSummary['status']; orgId: string }) {
  const styles: Record<OrgSummary['status'], string> = {
    active: 'bg-status-allow/15 text-status-allow',
    suspended: 'bg-status-warning/15 text-status-warning',
    deleted: 'bg-status-deny/15 text-status-deny',
  }
  return (
    <span
      data-testid={`status-${orgId}`}
      className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[11px] font-mono ${styles[status]}`}
    >
      {status}
    </span>
  )
}

function EmptyState() {
  return (
    <div data-testid="orgs-empty" className="flex flex-col items-center justify-center py-20 gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {/* Octógono outline */}
        <polygon
          points="60,10 100,30 110,70 90,110 30,110 10,70 20,30 60,10"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Chave pontilhada ausente */}
        <rect
          x="42" y="52" width="36" height="16" rx="8"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
        <rect
          x="68" y="58" width="8" height="6" rx="2"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
      </svg>
      <p className="text-[15px] text-text-primary">Nenhuma organização criada</p>
      <p className="text-[13px] text-text-secondary">Crie a primeira organização para começar.</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div data-testid="orgs-loading" className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-[9px] border-b border-border-default/30">
          <div className="h-3 w-40 bg-surface-elevated rounded animate-pulse" />
          <div className="h-5 w-16 bg-surface-elevated rounded-pill animate-pulse" />
          <div className="h-3 w-8 bg-surface-elevated rounded animate-pulse ml-auto" />
          <div className="h-3 w-8 bg-surface-elevated rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function OrgsList({ token, onSelectOrg, refreshKey = 0 }: OrgsListProps) {
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOrgs(null)
    setError(false)
    listOrgs(token)
      .then((data) => { if (!cancelled) setOrgs(data) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [token, refreshKey])

  if (error) {
    return (
      <div data-testid="orgs-error" className="flex items-center justify-center py-12">
        <p className="text-sm text-status-deny">Erro ao carregar organizações.</p>
      </div>
    )
  }

  if (orgs === null) return <LoadingSkeleton />
  if (orgs.length === 0) return <EmptyState />

  return (
    <div className="w-full">
      {/* Header da tabela */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-border-default">
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex-1">Nome</span>
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-24">Status</span>
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-16 text-right">Usuários</span>
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-20 text-right">Workspaces</span>
        <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-16 text-right">Atividade</span>
      </div>

      {/* Linhas */}
      {orgs.map((org) => (
        <button
          key={org._id}
          onClick={() => onSelectOrg(org._id)}
          className="w-full flex items-center gap-4 px-4 py-[8px] border-b border-border-default/30 hover:bg-surface-hover transition-colors duration-200 cursor-pointer text-left"
        >
          <span className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 size={14} className="text-text-secondary flex-shrink-0" />
            <span className="text-sm text-text-primary truncate">{org.name}</span>
          </span>
          <span className="w-24">
            <StatusPill status={org.status} orgId={org._id} />
          </span>
          <span
            data-testid={`users-count-${org._id}`}
            className="w-16 text-right text-sm font-mono text-text-secondary"
          >
            {org.usersCount}
          </span>
          <span
            data-testid={`workspaces-count-${org._id}`}
            className="w-20 text-right text-sm font-mono text-text-secondary"
          >
            {org.workspacesCount}
          </span>
          <span className="w-16 text-right text-[12px] font-mono text-text-muted">
            {formatRelative(org.updatedAt)}
          </span>
        </button>
      ))}
    </div>
  )
}
