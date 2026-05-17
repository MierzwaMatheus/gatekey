import { useEffect, useState, useRef } from 'react'
import { LayoutGrid, Plus, ExternalLink } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { listWorkspaces, type WorkspaceSummary } from '../../lib/org-api'

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="mb-5">
        <polygon
          points="45,8 75,8 104,37 104,83 75,112 45,112 16,83 16,37"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        <rect x="38" y="46" width="14" height="14" rx="2" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
        <rect x="56" y="46" width="14" height="14" rx="2" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
        <rect x="38" y="64" width="14" height="14" rx="2" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
        <rect x="56" y="64" width="14" height="14" rx="2" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
      </svg>
      <p className="text-[15px] text-text-primary font-medium mb-1">Nenhum workspace ainda</p>
      <p className="text-[13px] text-text-secondary mb-5">Crie o primeiro workspace desta organização</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
      >
        <Plus size={14} />
        Criar workspace
      </button>
    </div>
  )
}

interface WorkspacesListProps {
  token: string
  orgId: string
  onAddWorkspace: () => void
}

export function WorkspacesList({ token, orgId, onAddWorkspace }: WorkspacesListProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()
  const abortRef = useRef<AbortController | null>(null)

  function load() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(false)
    listWorkspaces(token)
      .then((data) => { if (!ac.signal.aborted) setWorkspaces(data) })
      .catch(() => { if (!ac.signal.aborted) setError(true) })
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [token])

  if (error) {
    return (
      <div className="py-8 text-center text-sm text-status-deny">
        Erro ao carregar workspaces.
        <button onClick={load} className="ml-2 underline cursor-pointer">Tentar novamente</button>
      </div>
    )
  }

  if (workspaces === null) {
    return (
      <div className="space-y-2" data-testid="workspaces-loading">
        {[1, 2].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-[6px]" />
        ))}
      </div>
    )
  }

  if (workspaces.length === 0) {
    return <EmptyState onAdd={onAddWorkspace} />
  }

  return (
    <div className="border border-border-default rounded-card overflow-hidden shadow-card" data-testid="workspaces-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default bg-surface-elevated">
            <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Nome</th>
            <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Status</th>
            <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Membros</th>
            <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Criado em</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {workspaces.map((ws) => (
            <tr
              key={ws._id}
              className="border-b border-border-default last:border-0 hover:bg-surface-hover transition-colors group"
            >
              <td className="px-4 py-2.5 text-[13px] text-text-primary flex items-center gap-2">
                <LayoutGrid size={14} className="text-text-secondary flex-shrink-0" />
                {ws.name}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={[
                    'inline-flex px-2 py-0.5 text-[11px] font-medium rounded-pill',
                    ws.status === 'active'
                      ? 'bg-status-allow/15 text-status-allow'
                      : 'bg-status-deny/15 text-status-deny',
                  ].join(' ')}
                >
                  {ws.status}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[13px] text-text-secondary font-mono">{ws.membersCount}</td>
              <td className="px-4 py-2.5 text-[12px] text-text-secondary font-mono">{formatDate(ws.createdAt)}</td>
              <td className="px-4 py-2.5">
                <button
                  onClick={() => navigate({ to: `/org/${orgId}/workspace/${ws._id}` })}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] text-accent-primary border border-accent-primary/30 rounded-[4px] hover:bg-accent-subtle transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                >
                  <ExternalLink size={11} />
                  Abrir painel
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
