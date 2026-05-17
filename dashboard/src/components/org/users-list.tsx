import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { suspendUser, resetUserPassword, type UserSummary } from '../../lib/org-api'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m atrás`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h atrás`
  return `${Math.floor(hours / 24)}d atrás`
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="mb-5">
        {/* Octógono outline */}
        <polygon
          points="45,8 75,8 104,37 104,83 75,112 45,112 16,83 16,37"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Chave pontilhada ausente */}
        <circle cx="52" cy="60" r="10" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
        <line x1="62" y1="60" x2="80" y2="60" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="74" y1="60" x2="74" y2="66" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="68" y1="60" x2="68" y2="66" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
      </svg>
      <p className="text-[15px] text-text-primary font-medium mb-1">Nenhum usuário ainda</p>
      <p className="text-[13px] text-text-secondary mb-5">Crie o primeiro usuário desta organização</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
      >
        <Plus size={14} />
        Criar usuário
      </button>
    </div>
  )
}

function SuspendModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">Suspender usuário</h2>
        <p className="text-[13px] text-text-secondary mb-1">
          Tem certeza que deseja suspender{' '}
          <span className="font-mono text-status-deny">{user.email}</span>?
        </p>
        <p className="text-[12px] text-text-secondary mb-5">
          O usuário perderá acesso imediatamente.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Suspendendo…' : 'Suspender'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: (password: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (newPassword.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres')
      return
    }
    onConfirm(newPassword)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">Redefinir senha</h2>
        <p className="text-[13px] text-text-secondary mb-4">
          Nova senha para{' '}
          <span className="font-mono text-text-primary">{user.email}</span>
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setError('') }}
          placeholder="Nova senha (mín. 8 caracteres)"
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent mb-1"
        />
        {error && <p className="text-[12px] text-status-deny mb-3">{error}</p>}
        {!error && <div className="mb-3" />}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || newPassword.length < 8}
            className="px-3 py-1.5 text-[13px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Salvando…' : 'Salvar senha'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface UsersListProps {
  token: string
  orgId: string
  onAddUser: () => void
}

export function UsersList({ token, orgId, onAddUser }: UsersListProps) {
  const [suspendTarget, setSuspendTarget] = useState<UserSummary | null>(null)
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const queryResult = useQuery(
    api.users.listUsersQuery,
    token ? { token, orgId: orgId as Id<'orgs'> } : 'skip',
  )

  const users = queryResult as UserSummary[] | undefined

  async function handleSuspend() {
    if (!suspendTarget) return
    setActionLoading(true)
    try {
      await suspendUser(token, suspendTarget._id)
      setSuspendTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetPassword(newPassword: string) {
    if (!resetTarget) return
    setActionLoading(true)
    try {
      await resetUserPassword(token, resetTarget._id, newPassword)
      setResetTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  if (users === undefined) {
    return (
      <div className="space-y-2" data-testid="users-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-[6px]" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return <EmptyState onAdd={onAddUser} />
  }

  return (
    <>
      <div className="border border-border-default rounded-card overflow-hidden shadow-card">
        <table className="w-full text-sm" data-testid="users-table">
          <thead>
            <tr className="border-b border-border-default bg-surface-elevated">
              <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-2.5 text-[12px] font-medium text-text-secondary uppercase tracking-wide">Atualizado</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user._id}
                className="border-b border-border-default last:border-0 hover:bg-surface-hover transition-colors group"
              >
                <td className="px-4 py-2.5 font-mono text-[13px] text-text-primary">{user.email}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={[
                      'inline-flex px-2 py-0.5 text-[11px] font-medium rounded-pill',
                      user.status === 'active'
                        ? 'bg-status-allow/15 text-status-allow'
                        : 'bg-status-deny/15 text-status-deny',
                    ].join(' ')}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-[13px] text-text-secondary font-mono">{user.orgRole}</td>
                <td className="px-4 py-2.5 text-[12px] text-text-secondary font-mono">
                  {formatRelativeTime(user.updatedAt)}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    {user.status === 'active' && (
                      <button
                        onClick={() => setSuspendTarget(user)}
                        className="px-2 py-1 text-[11px] text-status-deny border border-status-deny/30 rounded-[4px] hover:bg-status-deny/10 transition-colors cursor-pointer"
                      >
                        Suspender
                      </button>
                    )}
                    <button
                      onClick={() => setResetTarget(user)}
                      className="px-2 py-1 text-[11px] text-text-secondary border border-border-default rounded-[4px] hover:bg-surface-elevated transition-colors cursor-pointer"
                    >
                      Redefinir senha
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {suspendTarget && (
        <SuspendModal
          user={suspendTarget}
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
          loading={actionLoading}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onConfirm={handleResetPassword}
          onCancel={() => setResetTarget(null)}
          loading={actionLoading}
        />
      )}
    </>
  )
}
