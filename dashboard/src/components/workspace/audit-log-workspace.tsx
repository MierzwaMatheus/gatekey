import { useState } from 'react'
import { usePaginatedQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import type { AuditEvent } from '../../lib/workspace-api'
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
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

interface AuditLogWorkspaceProps {
  token: string
  orgId: string
  wsId: string
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function AuditLogWorkspace({ token, orgId, wsId }: AuditLogWorkspaceProps) {
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<'allow' | 'deny' | ''>('')

  const { results, status, loadMore } = usePaginatedQuery(
    api.auditLog.listAuditLogQuery,
    token
      ? {
          token,
          orgId: orgId as Id<'orgs'>,
          workspaceId: wsId as Id<'workspaces'>,
          action: actionFilter || undefined,
          result: (resultFilter || undefined) as 'allow' | 'deny' | undefined,
        }
      : 'skip',
    { initialNumItems: 50 },
  )

  const logs = results as AuditEvent[]
  const isLoading = status === 'LoadingFirstPage'
  const isDone = status === 'Exhausted'

  if (isLoading) {
    return (
      <div data-testid="audit-log-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3">
        <input
          data-testid="filter-action"
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filtrar por action…"
          className="px-3 py-1.5 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none w-48"
        />
        <select
          data-testid="filter-result"
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as 'allow' | 'deny' | '')}
          className="px-3 py-1.5 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
        >
          <option value="">Todos os resultados</option>
          <option value="allow">allow</option>
          <option value="deny">deny</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div data-testid="audit-log-empty" className="text-center py-12">
          <p className="text-text-muted text-sm">Nenhum evento de auditoria encontrado.</p>
        </div>
      ) : (
        <DenseGridContainer>
          <DenseGridHeader
            label="Audit Log"
            stats={[{ label: 'eventos', value: logs.length }]}
          />
          <DenseGridTable>
            <DenseGridThead>
              <DenseGridThNum />
              <DenseGridTh>Quando</DenseGridTh>
              <DenseGridTh>Ator</DenseGridTh>
              <DenseGridTh>Action</DenseGridTh>
              <DenseGridTh>Resultado</DenseGridTh>
            </DenseGridThead>
            <tbody>
              {logs.map((log, i) => (
                <DenseGridRow key={log._id} testId={`log-row-${log._id}`}>
                  <DenseGridRowNum index={i} />
                  <DenseGridCellStack
                    primary={<span className="text-[11px] text-[#6E7681]">{relativeTime(log.timestamp)}</span>}
                  />
                  <DenseGridCellStack primary={log.actorId} />
                  <DenseGridCellStack primary={log.action} />
                  <DenseGridCellStack
                    primary={
                      <span data-testid={`result-badge-${log._id}`}>
                        <DenseGridStatusBadge
                          value={log.result}
                          type={log.result === 'allow' ? 'allow' : 'deny'}
                        />
                      </span>
                    }
                  />
                </DenseGridRow>
              ))}
            </tbody>
          </DenseGridTable>
          <DenseGridFooter
            showing={logs.length}
            onLoadMore={!isDone ? () => loadMore(50) : undefined}
            loadingMore={status === 'LoadingMore'}
            isDone={isDone}
          />
        </DenseGridContainer>
      )}
    </div>
  )
}
