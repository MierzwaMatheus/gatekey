import { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Link,
  Unlink,
  LogIn,
  LogOut,
  Shield,
  Key,
  AlertCircle,
  Building2,
  ScrollText,
} from 'lucide-react'
import { listAuditLog, type AuditEvent } from '../../lib/root-api'

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  return `${Math.floor(hrs / 24)}d atrás`
}

function isoTimestamp(ts: number): string {
  return new Date(ts).toISOString()
}

function getEventIcon(action: string) {
  if (action.startsWith('auth.login')) return LogIn
  if (action.startsWith('auth.logout')) return LogOut
  if (action.startsWith('binding')) return Link
  if (action.includes('revoke') || action.includes('delete')) return Unlink
  if (action.startsWith('org')) return Building2
  if (action.startsWith('api_key')) return Key
  if (action.startsWith('session')) return Shield
  if (action.startsWith('capability') || action.startsWith('role')) return Plus
  return ScrollText
}

/* Círculo de ícone na timeline com cor baseada no tipo de evento */
function EventCircle({ action, result }: { action: string; result: string }) {
  const Icon = getEventIcon(action)

  let circleStyle = 'bg-surface-elevated'
  if (result === 'deny') circleStyle = 'bg-status-deny/20'
  else if (action.startsWith('org') && action.includes('create')) circleStyle = 'bg-accent-subtle'

  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${circleStyle}`}>
      <Icon size={11} className="text-text-secondary" />
    </div>
  )
}

function ActorPill({ role }: { role?: string }) {
  if (!role) return null
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono rounded-badge bg-accent-subtle text-accent-primary">
      {role}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div data-testid="audit-loading" className="space-y-0">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-3 px-4 py-3 border-b border-border-default/20">
          <div className="w-5 h-5 rounded-full bg-surface-elevated animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 bg-surface-elevated rounded animate-pulse" />
            <div className="h-2.5 w-32 bg-surface-elevated rounded animate-pulse" />
          </div>
          <div className="h-2.5 w-16 bg-surface-elevated rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div data-testid="audit-empty" className="flex flex-col items-center justify-center py-16 gap-3">
      <ScrollText size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">Nenhum evento registrado.</p>
    </div>
  )
}

interface AuditLogTableProps {
  token: string
  orgId?: string
}

export function AuditLogTable({ token, orgId }: AuditLogTableProps) {
  const [filterAction, setFilterAction] = useState('')
  const [filterResult, setFilterResult] = useState<'' | 'allow' | 'deny'>('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  const [logs, setLogs] = useState<AuditEvent[] | undefined>(undefined)
  const [isDone, setIsDone] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchLogs = useCallback(async (cur?: string | null) => {
    if (!token) return
    try {
      const page = await listAuditLog(token, {
        orgId,
        action: filterAction || undefined,
        result: (filterResult || undefined) as 'allow' | 'deny' | undefined,
        from: filterFrom ? new Date(filterFrom).getTime() : undefined,
        to: filterTo ? new Date(filterTo).getTime() : undefined,
        cursor: cur ?? undefined,
        numItems: 50,
      })
      if (cur) {
        setLogs((prev) => [...(prev ?? []), ...page.logs])
      } else {
        setLogs(page.logs)
      }
      setIsDone(page.isDone)
      setCursor(page.cursor)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [token, orgId, filterAction, filterResult, filterFrom, filterTo])

  useEffect(() => {
    setIsLoading(true)
    setLogs(undefined)
    fetchLogs(null)
  }, [fetchLogs])

  function loadMore() {
    setIsLoadingMore(true)
    fetchLogs(cursor)
  }

  return (
    <div className="space-y-3">
      {/* Toolbar de filtros */}
      <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-border-default">
        <input
          data-testid="filter-action"
          type="text"
          placeholder="action (ex: binding.create)"
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors w-44"
        />
        <select
          data-testid="filter-result"
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value as '' | 'allow' | 'deny')}
          className="px-2.5 py-1.5 text-[11px] bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent transition-colors"
        >
          <option value="">Todos</option>
          <option value="allow">ALLOW</option>
          <option value="deny">DENY</option>
        </select>
        <input
          data-testid="filter-from"
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent transition-colors"
        />
        <input
          data-testid="filter-to"
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="px-2.5 py-1.5 text-[11px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent transition-colors"
        />
      </div>

      {/* Timeline */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : !logs || logs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="relative">
          {logs.map((event, idx) => {
            const isDeny = event.result === 'deny'
            const isLast = idx === logs.length - 1

            return (
              <div
                key={event._id}
                data-testid={`audit-event-${event._id}`}
                className={[
                  'flex gap-3 px-4 py-3 border-b border-border-default/20 hover:bg-surface-hover transition-colors',
                  isDeny ? 'border-l-2 border-l-accent-primary' : '',
                ].join(' ')}
              >
                {/* Coluna da timeline */}
                <div className="flex flex-col items-center gap-0 flex-shrink-0">
                  <EventCircle action={event.action} result={event.result} />
                  {/* Conector vertical */}
                  {!isLast && (
                    <div
                      data-testid={`timeline-connector-${event._id}`}
                      className="w-px flex-1 bg-border-default min-h-[16px] mt-1"
                    />
                  )}
                </div>

                {/* Conteúdo do evento */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ActorPill role={event.actorRole} />
                    <span
                      data-testid={`audit-action-${event._id}`}
                      className="text-[12px] font-mono font-medium text-text-primary"
                    >
                      {event.action}
                    </span>
                    <span className="text-[11px] font-mono text-text-muted">
                      → {event.target.type}:{event.target.id.slice(0, 8)}
                    </span>
                    {isDeny && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-status-deny">
                        <AlertCircle size={10} />
                        {event.reason ?? 'DENY'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-text-muted truncate">
                    {event.actorId.slice(0, 20)}
                  </p>
                </div>

                {/* Timestamp */}
                <span
                  title={isoTimestamp(event.timestamp)}
                  className="text-[11px] font-mono text-text-muted flex-shrink-0 self-start"
                >
                  {formatRelative(event.timestamp)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Carregar mais */}
      {!isDone && logs && logs.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            data-testid="btn-load-more"
            onClick={() => loadMore()}
            disabled={isLoadingMore}
            className="px-4 py-2 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isLoadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  )
}
