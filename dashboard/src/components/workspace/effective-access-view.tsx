import { useState, useEffect } from 'react'
import { listMembers, getEffectiveAccess, type WorkspaceMember, type EffectiveAccessResult } from '../../lib/workspace-api'

interface Props {
  token: string
  wsId: string
}

function parseInheritedSource(source: string): string | null {
  const match = source.match(/^inherited-from-[^:]+:(.+)$/)
  return match ? match[1] : null
}

export function EffectiveAccessView({ token, wsId }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [accessData, setAccessData] = useState<EffectiveAccessResult | null>(null)
  const [accessLoading, setAccessLoading] = useState(false)
  const [resourceTypeFilter, setResourceTypeFilter] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    listMembers(token, wsId)
      .then(setMembers)
      .finally(() => setLoading(false))
  }, [token, wsId])

  useEffect(() => {
    if (!selectedUserId) return
    setAccessLoading(true)
    getEffectiveAccess(token, selectedUserId, wsId)
      .then(setAccessData)
      .finally(() => setAccessLoading(false))
  }, [token, selectedUserId, wsId, refreshKey])

  if (loading) {
    return <div data-testid="effective-access-loading" className="animate-pulse h-8 bg-surface-secondary rounded" />
  }

  const filteredResources = (accessData?.resourceAccess ?? []).filter(
    (r) => !resourceTypeFilter || r.resourceType === resourceTypeFilter
  )

  const resourceTypes = Array.from(new Set((accessData?.resourceAccess ?? []).map((r) => r.resourceType)))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <select
          data-testid="select-user"
          value={selectedUserId}
          onChange={(e) => { setSelectedUserId(e.target.value); setAccessData(null); setResourceTypeFilter('') }}
          className="px-2 py-1.5 text-[12px] bg-surface-secondary border border-border-default rounded text-text-primary"
        >
          <option value="">— Selecionar usuário —</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>{m.userName}</option>
          ))}
        </select>

        {selectedUserId && (
          <button
            data-testid="btn-refresh"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="px-3 py-1.5 text-[12px] border border-border-default rounded text-text-secondary hover:bg-surface-hover"
          >
            Atualizar
          </button>
        )}
      </div>

      {selectedUserId && !accessLoading && accessData && (
        <div className="space-y-5">
          {/* Workspace access */}
          {accessData.workspaceAccess ? (
            <div data-testid="workspace-access-section" className="p-4 border border-border-default rounded space-y-1">
              <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Acesso ao workspace inteiro</p>
              <p className="text-[13px] text-text-primary">
                Role: <span className="font-mono text-accent-primary">{accessData.workspaceAccess.role}</span>
              </p>
              <p className="text-[11px] text-text-muted">Fonte: workspace-binding</p>
            </div>
          ) : (
            <div data-testid="workspace-access-empty" className="p-4 border border-border-default rounded text-[12px] text-text-muted">
              Sem binding de workspace
            </div>
          )}

          {/* Resource access */}
          {accessData.resourceAccess.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wide">Acesso por recurso</p>
                <select
                  data-testid="select-resource-type"
                  value={resourceTypeFilter}
                  onChange={(e) => setResourceTypeFilter(e.target.value)}
                  className="px-2 py-1 text-[11px] bg-surface-secondary border border-border-default rounded text-text-primary"
                >
                  <option value="">Todos os tipos</option>
                  {resourceTypes.map((rt) => (
                    <option key={rt} value={rt}>{rt}</option>
                  ))}
                </select>
              </div>

              <table data-testid="resource-table" className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-text-muted border-b border-border-default">
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">ID do recurso</th>
                    <th className="pb-2 pr-4">Role efetivo</th>
                    <th className="pb-2 pr-4">Fonte</th>
                    <th className="pb-2">Expira em</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResources.map((r) => {
                    const inheritedId = parseInheritedSource(r.source)
                    return (
                      <tr
                        key={r.resourceId}
                        data-testid={`resource-row-${r.resourceId}`}
                        className="border-b border-border-default/50"
                      >
                        <td className="py-2 pr-4 font-mono text-text-secondary">{r.resourceType}</td>
                        <td className="py-2 pr-4 font-mono">{r.resourceId}</td>
                        <td className="py-2 pr-4">
                          {r.effectiveRole === null ? (
                            <span
                              data-testid="access-denied-badge"
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-[var(--gate-danger)]/20 text-[var(--gate-danger)] rounded"
                            >
                              Acesso negado
                            </span>
                          ) : (
                            <span className="font-mono text-[var(--gate-safe)]">{r.effectiveRole}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {inheritedId ? (
                            <span
                              data-testid="inherited-badge"
                              title={`Herdado do container: ${inheritedId}`}
                              className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded cursor-help"
                            >
                              Herdado de {inheritedId}
                            </span>
                          ) : r.source === 'explicit-deny' ? (
                            <span className="text-[var(--gate-danger)] text-[11px]">Negado explicitamente</span>
                          ) : r.source === 'workspace-binding' ? (
                            <span className="text-[var(--gate-safe)] text-[11px]">Do workspace</span>
                          ) : (
                            <span className="text-text-muted text-[11px]">Direto</span>
                          )}
                        </td>
                        <td className="py-2 text-text-muted">
                          {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
