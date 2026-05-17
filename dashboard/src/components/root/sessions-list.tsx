import { useState } from 'react'
import { useQuery } from 'convex/react'
import { MonitorDot, X } from 'lucide-react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { revokeSession, type SessionSummary } from '../../lib/root-api'


function formatExpiry(ts: number): string {
  const diff = ts - Date.now()
  if (diff <= 0) return 'expirada'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `expira em ${mins}m`
  return `expira em ${Math.floor(mins / 60)}h`
}

function LoadingSkeleton() {
  return (
    <div data-testid="sessions-loading" className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-[9px] border-b border-border-default/30">
          <div className="h-3 w-32 bg-surface-elevated rounded animate-pulse font-mono" />
          <div className="h-3 w-24 bg-surface-elevated rounded animate-pulse" />
          <div className="h-3 w-20 bg-surface-elevated rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div data-testid="sessions-empty" className="flex flex-col items-center justify-center py-16 gap-3">
      <MonitorDot size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">Nenhuma sessão ativa.</p>
    </div>
  )
}

interface RevokeModalProps {
  session: SessionSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function RevokeModal({ session, onConfirm, onCancel, loading }: RevokeModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div data-testid="modal-revoke-session" className="bg-surface-card border border-border-default rounded-card shadow-float w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">Revogar sessão</h3>
          <button onClick={onCancel} className="text-text-secondary hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-text-secondary">
          A sessão do usuário{' '}
          <span className="font-mono text-text-primary">{session.userId}</span>{' '}
          será revogada imediatamente.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-revoke"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            data-testid="btn-confirm-revoke"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Revogando…' : 'Revogar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SessionsListProps {
  token: string
}

export function SessionsList({ token }: SessionsListProps) {
  const [userIdFilter, setUserIdFilter] = useState('')
  const [orgIdFilter, setOrgIdFilter] = useState('')
  const [revoking, setRevoking] = useState<SessionSummary | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  const queryResult = useQuery(
    api.sessions.listSessionsQuery,
    token
      ? {
          token,
          userId: (userIdFilter || undefined) as Id<'users'> | undefined,
        }
      : 'skip',
  )

  const sessions = queryResult as SessionSummary[] | undefined

  const filtered = sessions?.filter((s) =>
    (!orgIdFilter || s.orgId === orgIdFilter),
  )

  async function handleRevoke() {
    if (!revoking) return
    setRevokeLoading(true)
    try {
      await revokeSession(token, revoking._id)
      setRevoking(null)
    } finally {
      setRevokeLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="flex items-center gap-3 pb-3 border-b border-border-default">
        <input
          data-testid="filter-user-id"
          type="text"
          placeholder="Filtrar por userId…"
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 text-[12px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
        <input
          data-testid="filter-org-id"
          type="text"
          placeholder="Filtrar por orgId…"
          value={orgIdFilter}
          onChange={(e) => setOrgIdFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 text-[12px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
      </div>

      {/* Lista */}
      {filtered === undefined ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border-default">
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide flex-1">UserId</span>
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-28">IP</span>
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-24">Dispositivo</span>
            <span className="text-[11px] font-medium text-text-secondary uppercase tracking-wide w-28 text-right">Expiração</span>
            <span className="w-8" />
          </div>

          {filtered.map((session) => (
            <div
              key={session._id}
              data-testid={`session-row-${session._id}`}
              className="group flex items-center gap-3 px-4 py-[8px] border-b border-border-default/30 hover:bg-surface-hover transition-colors duration-200"
            >
              <span
                data-testid={`session-userid-${session._id}`}
                className="flex-1 text-[12px] font-mono text-text-primary truncate"
              >
                {session.userId}
              </span>
              <span
                data-testid={`session-ip-${session._id}`}
                className="w-28 text-[12px] font-mono text-text-secondary"
              >
                {session.ip ?? '—'}
              </span>
              <span className="w-24 text-[11px] text-text-muted truncate">
                {session.deviceInfo ? session.deviceInfo.slice(0, 20) : '—'}
              </span>
              <span className="w-28 text-right text-[11px] font-mono text-text-muted">
                {formatExpiry(session.expiresAt)}
              </span>
              <button
                data-testid={`btn-revoke-${session._id}`}
                onClick={() => setRevoking(session)}
                className="w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded p-1 hover:bg-status-deny/10 text-status-deny"
                title="Revogar sessão"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {revoking && (
        <RevokeModal
          session={revoking}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
          loading={revokeLoading}
        />
      )}
    </div>
  )
}
