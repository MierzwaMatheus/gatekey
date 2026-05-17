import { useState, useEffect, useCallback } from 'react'
import { listWorkspaceAuditLog, type AuditEvent } from '../../lib/workspace-api'

interface AuditLogWorkspaceProps {
  token: string
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

export function AuditLogWorkspace({ token, wsId }: AuditLogWorkspaceProps) {
  const [logs, setLogs] = useState<AuditEvent[] | null>(null)
  const [isDone, setIsDone] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<'allow' | 'deny' | ''>('')

  const load = useCallback(
    async (params: { action?: string; result?: 'allow' | 'deny'; cursor?: string } = {}) => {
      const page = await listWorkspaceAuditLog(token, wsId, params)
      return page
    },
    [token, wsId],
  )

  useEffect(() => {
    setLogs(null)
    const params: Parameters<typeof listWorkspaceAuditLog>[2] = {}
    if (actionFilter) params.action = actionFilter
    if (resultFilter) params.result = resultFilter
    load(params)
      .then((page) => {
        setLogs(page.logs)
        setIsDone(page.isDone)
        setCursor(page.cursor)
      })
      .catch(() => setLogs([]))
  }, [load, actionFilter, resultFilter])

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const params: Parameters<typeof listWorkspaceAuditLog>[2] = { cursor }
      if (actionFilter) params.action = actionFilter
      if (resultFilter) params.result = resultFilter
      const page = await listWorkspaceAuditLog(token, wsId, params)
      setLogs((prev) => [...(prev ?? []), ...page.logs])
      setIsDone(page.isDone)
      setCursor(page.cursor)
    } finally {
      setLoadingMore(false)
    }
  }

  if (logs === null) {
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
        <>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Quando</th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Ator</th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Action</th>
                <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log._id}
                  data-testid={`log-row-${log._id}`}
                  className="border-b border-border-default hover:bg-surface-hover"
                >
                  <td className="py-2.5 px-3 text-text-muted text-xs">{relativeTime(log.timestamp)}</td>
                  <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">{log.actorId}</td>
                  <td className="py-2.5 px-3 text-text-primary text-xs font-mono">{log.action}</td>
                  <td className="py-2.5 px-3">
                    <span
                      data-testid={`result-badge-${log._id}`}
                      className={[
                        'px-2 py-0.5 rounded-pill text-xs',
                        log.result === 'allow'
                          ? 'bg-status-allow/10 text-status-allow'
                          : 'bg-status-deny/10 text-status-deny',
                      ].join(' ')}
                    >
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isDone && (
            <div className="flex justify-center pt-2">
              <button
                data-testid="btn-load-more"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover disabled:opacity-60 cursor-pointer"
              >
                {loadingMore ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
