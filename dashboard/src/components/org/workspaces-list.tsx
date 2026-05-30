import { useEffect, useState, useRef } from 'react'
import { LayoutGrid, Plus, ExternalLink } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { listWorkspaces, type WorkspaceSummary } from '../../lib/org-api'
import {
  DenseGridContainer,
  DenseGridHeader,
  DenseGridTable,
  DenseGridThead,
  DenseGridTh,
  DenseGridThNum,
  DenseGridRow,
  DenseGridRowNum,
  DenseGridCellStack,
  DenseGridCell,
  DenseGridActionsCell,
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

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
    <DenseGridContainer testId="workspaces-table">
      <DenseGridHeader label="Workspaces" stats={[{ label: 'total', value: workspaces.length }]} />
      <DenseGridTable>
        <DenseGridThead>
          <DenseGridThNum />
          <DenseGridTh>Nome</DenseGridTh>
          <DenseGridTh>Status</DenseGridTh>
          <DenseGridTh>Membros</DenseGridTh>
          <DenseGridTh>Criado em</DenseGridTh>
          <DenseGridTh align="right">Ações</DenseGridTh>
        </DenseGridThead>
        <tbody>
          {workspaces.map((ws, i) => (
            <DenseGridRow key={ws._id}>
              <DenseGridRowNum index={i} />
              <DenseGridCellStack
                primary={
                  <span className="flex items-center gap-1.5">
                    <LayoutGrid size={12} className="text-[#6E7681] flex-shrink-0" />
                    {ws.name}
                  </span>
                }
              />
              <DenseGridCell>
                <DenseGridStatusBadge
                  value={ws.status}
                  type={ws.status === 'active' ? 'allow' : 'deny'}
                />
              </DenseGridCell>
              <DenseGridCell>
                <span className="text-[11px] text-[#8B949E]">{ws.membersCount}</span>
              </DenseGridCell>
              <DenseGridCell>
                <span className="text-[11px] text-[#6E7681]">{formatDate(ws.createdAt)}</span>
              </DenseGridCell>
              <DenseGridActionsCell>
                <button
                  onClick={() => navigate({ to: `/org/${orgId}/workspace/${ws._id}` })}
                  className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[#58A6FF] border border-[#58A6FF]/30 rounded-[2px] hover:bg-[#58A6FF]/10 transition-colors cursor-pointer"
                >
                  <ExternalLink size={10} />
                  Abrir
                </button>
              </DenseGridActionsCell>
            </DenseGridRow>
          ))}
        </tbody>
      </DenseGridTable>
      <DenseGridFooter showing={workspaces.length} />
    </DenseGridContainer>
  )
}
