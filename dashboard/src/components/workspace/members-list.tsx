import { useState, useEffect, useRef } from 'react'
import { listMembers, removeMember, changeMemberRole, listRoles, type WorkspaceMember } from '../../lib/workspace-api'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface MembersListProps {
  token: string
  wsId: string
  onAddMember: () => void
  refreshKey?: number
}

export function MembersList({ token, wsId, onAddMember, refreshKey }: MembersListProps) {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null)
  const [error, setError] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WorkspaceMember | null>(null)
  const [changeRoleTarget, setChangeRoleTarget] = useState<WorkspaceMember | null>(null)
  const [roles, setRoles] = useState<{ _id: string; name: string }[]>([])
  const [newRoleId, setNewRoleId] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setMembers(null)
    setError(false)

    Promise.all([listMembers(token, wsId), listRoles(token, wsId)])
      .then(([data, r]) => {
        if (!ac.signal.aborted) {
          setMembers(data)
          setRoles(r)
        }
      })
      .catch(() => { if (!ac.signal.aborted) setError(true) })

    return () => ac.abort()
  }, [token, wsId, refreshKey])

  async function handleRemove() {
    if (!removeTarget) return
    setActionLoading(true)
    try {
      await removeMember(token, wsId, removeTarget.userId)
      setRemoveTarget(null)
      setMembers((prev) => prev?.filter((m) => m.userId !== removeTarget.userId) ?? null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleChangeRole() {
    if (!changeRoleTarget || !newRoleId) return
    setActionLoading(true)
    try {
      await changeMemberRole(token, wsId, changeRoleTarget.userId, newRoleId)
      setChangeRoleTarget(null)
      setNewRoleId('')
      setMembers((prev) => prev?.map((m) =>
        m.userId === changeRoleTarget.userId
          ? { ...m, roleName: roles.find((r) => r._id === newRoleId)?.name ?? m.roleName }
          : m
      ) ?? null)
    } finally {
      setActionLoading(false)
    }
  }

  if (error) {
    return (
      <div data-testid="members-error" className="text-status-deny text-sm py-4">
        Erro ao carregar membros.
      </div>
    )
  }

  if (members === null) {
    return (
      <div data-testid="members-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div data-testid="members-empty" className="text-center py-12">
        <p className="text-text-muted text-sm">Nenhum membro neste workspace.</p>
        <button
          onClick={onAddMember}
          className="mt-3 px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Adicionar membro
        </button>
      </div>
    )
  }

  return (
    <>
      <div data-testid="members-list">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Nome</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Email</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Role</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Adicionado</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.userId}
                data-testid={`member-row-${m.userId}`}
                className="border-b border-border-default hover:bg-surface-hover group"
              >
                <td className="py-2.5 px-3 text-text-primary font-medium">{m.userName}</td>
                <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">{m.userEmail}</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-pill bg-surface-elevated text-text-secondary text-xs">
                    {m.roleName}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-text-muted text-xs">{relativeTime(m.addedAt)}</td>
                <td className="py-2.5 px-3">
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setChangeRoleTarget(m); setNewRoleId('') }}
                      className="px-2 py-1 text-[11px] text-text-secondary border border-border-default rounded hover:bg-surface-hover cursor-pointer"
                    >
                      Trocar role
                    </button>
                    <button
                      onClick={() => setRemoveTarget(m)}
                      className="px-2 py-1 text-[11px] text-status-deny border border-border-default rounded hover:bg-surface-hover cursor-pointer"
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Remove confirmation modal */}
      {removeTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setRemoveTarget(null)}
        >
          <div
            className="bg-surface-card border border-border-default rounded-card p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary text-sm mb-4">
              Remover <strong>{removeTarget.userEmail}</strong> do workspace?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleRemove}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-status-deny text-white rounded-button disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? 'Removendo…' : 'Remover'}
              </button>
              <button
                onClick={() => setRemoveTarget(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change role modal */}
      {changeRoleTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setChangeRoleTarget(null)}
        >
          <div
            className="bg-surface-card border border-border-default rounded-card p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary text-sm mb-3">
              Trocar role de <strong>{changeRoleTarget.userEmail}</strong>
            </p>
            <select
              value={newRoleId}
              onChange={(e) => setNewRoleId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary mb-4"
            >
              <option value="">Selecione um role…</option>
              {roles.map((r) => (
                <option key={r._id} value={r._id}>{r.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleChangeRole}
                disabled={actionLoading || !newRoleId}
                className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? 'Salvando…' : 'Salvar'}
              </button>
              <button
                onClick={() => setChangeRoleTarget(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
