import { useState, useEffect } from 'react'
import { listUsers } from '../../lib/org-api'
import { listRoles, addMember } from '../../lib/workspace-api'
import type { UserSummary } from '../../lib/org-api'
import type { WorkspaceRole } from '../../lib/workspace-api'

interface AddMemberFormProps {
  token: string
  wsId: string
  onSuccess: () => void
  onCancel: () => void
}

export function AddMemberForm({ token, wsId, onSuccess, onCancel }: AddMemberFormProps) {
  const [users, setUsers] = useState<UserSummary[] | null>(null)
  const [roles, setRoles] = useState<WorkspaceRole[] | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listUsers(token), listRoles(token, wsId)])
      .then(([u, r]) => { setUsers(u); setRoles(r) })
      .catch(() => setError('Erro ao carregar dados'))
  }, [token, wsId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return
    setLoading(true)
    setError(null)
    try {
      await addMember(token, wsId, { userId: selectedUser, roleId: selectedRole || undefined })
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!users || !roles) {
    return <div className="text-text-muted text-sm py-2">Carregando…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Usuário</label>
        <select
          data-testid="select-user"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
          required
        >
          <option value="">Selecione um usuário…</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>{u.email}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Role</label>
        <select
          data-testid="select-role"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
        >
          <option value="">Sem role específico</option>
          {roles.map((r) => (
            <option key={r._id} value={r._id}>{r.name}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-status-deny text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          data-testid="btn-add-member"
          disabled={loading || !selectedUser}
          className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? 'Adicionando…' : 'Adicionar'}
        </button>
        <button
          type="button"
          data-testid="btn-cancel-add-member"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
