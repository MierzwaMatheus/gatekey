import { useEffect, useState, useRef, useCallback } from 'react'
import { UserCheck, UserX, Key, Shield, Settings, Trash2 } from 'lucide-react'
import { listAuditLog, type AuditEvent, type AuditLogPage } from '../../lib/org-api'

function getEventIcon(action: string) {
  if (action.includes('login') || action.includes('auth')) return UserCheck
  if (action.includes('revoke') || action.includes('suspend') || action.includes('delete') || action.includes('deny')) return UserX
  if (action.includes('api_key')) return Key
  if (action.includes('binding') || action.includes('role')) return Shield
  if (action.includes('settings') || action.includes('create')) return Settings
  return Trash2
}

function getEventColor(action: string, result: 'allow' | 'deny'): string {
  if (result === 'deny') return 'bg-status-deny/20 text-status-deny'
  if (action.includes('revoke') || action.includes('suspend') || action.includes('delete')) return 'bg-status-deny/20 text-status-deny'
  if (action.includes('settings') || action.includes('org.')) return 'bg-accent-subtle text-accent-primary'
  return 'bg-surface-elevated text-text-secondary'
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

function EventRow({ event }: { event: AuditEvent }) {
  const Icon = getEventIcon(event.action)
  const colorClass = getEventColor(event.action, event.result)
  const isDeny = event.result === 'deny'

  return (
    <div
      className={[
        'flex gap-3 py-3 px-4 relative',
        isDeny ? 'border-l-2 border-accent-primary' : 'border-l-2 border-transparent',
      ].join(' ')}
    >
      {/* Ícone de evento */}
      <div className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full mt-0.5 ${colorClass}`}>
        <Icon size={10} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-mono text-text-secondary">{event.actorId.slice(-8)}</span>
          {event.actorRole && (
            <span className="px-1.5 py-0.5 text-[10px] bg-surface-elevated text-text-secondary rounded-badge font-mono">
              {event.actorRole}
            </span>
          )}
          <span className="text-[12px] font-mono font-medium text-text-primary">{event.action}</span>
          {event.target?.id && (
            <span className="text-[11px] font-mono text-text-secondary">→ {event.target.id.slice(-8)}</span>
          )}
        </div>
        {event.reason && (
          <p className="text-[11px] text-text-secondary mt-0.5 font-mono">{event.reason}</p>
        )}
      </div>

      {/* Timestamp */}
      <div className="flex-shrink-0">
        <span
          className="text-[11px] font-mono text-text-secondary"
          title={new Date(event.timestamp).toISOString()}
        >
          {formatRelativeTime(event.timestamp)}
        </span>
      </div>
    </div>
  )
}

interface AuditLogOrgProps {
  token: string
  orgId: string
}

export function AuditLogOrg({ token, orgId }: AuditLogOrgProps) {
  const [page, setPage] = useState<AuditLogPage | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<'' | 'allow' | 'deny'>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback((cursor?: string) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(false)
    setLoading(true)

    const params: Parameters<typeof listAuditLog>[1] = { orgId, numItems: 50 }
    if (actionFilter) params.action = actionFilter
    if (resultFilter) params.result = resultFilter as 'allow' | 'deny'
    if (cursor) params.cursor = cursor

    listAuditLog(token, params)
      .then((data) => {
        if (ac.signal.aborted) return
        if (cursor) {
          setPage((prev) => prev ? { ...data, logs: [...prev.logs, ...data.logs] } : data)
        } else {
          setPage(data)
        }
      })
      .catch(() => { if (!ac.signal.aborted) setError(true) })
      .finally(() => { if (!ac.signal.aborted) setLoading(false) })
  }, [token, orgId, actionFilter, resultFilter])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [load])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder="Filtrar por ação (ex: user.create)"
          className="px-3 py-1.5 text-[13px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent w-64"
        />
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as '' | 'allow' | 'deny')}
          className="px-3 py-1.5 text-[13px] bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent cursor-pointer"
        >
          <option value="">Todos resultados</option>
          <option value="allow">ALLOW</option>
          <option value="deny">DENY</option>
        </select>
      </div>

      {/* Timeline */}
      {error && <div className="py-8 text-center text-sm text-status-deny">Erro ao carregar audit log.</div>}

      {!error && (
        <div className="border border-border-default rounded-card overflow-hidden shadow-card divide-y divide-border-default relative">
          {/* Linha do tempo vertical */}
          <div className="absolute left-[18px] top-0 bottom-0 w-px bg-border-default" aria-hidden="true" />

          {page === null && (
            <div className="space-y-0">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-surface-elevated animate-pulse" />
              ))}
            </div>
          )}

          {page && page.logs.length === 0 && (
            <div className="py-12 text-center text-sm text-text-secondary">
              Nenhum evento encontrado com os filtros atuais.
            </div>
          )}

          {page && page.logs.map((event) => (
            <EventRow key={event._id} event={event} />
          ))}

          {page && !page.isDone && (
            <div className="p-4 text-center">
              <button
                onClick={() => load(page.cursor ?? undefined)}
                disabled={loading}
                className="px-4 py-2 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
              >
                {loading ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
