import { useState, useEffect } from 'react'
import { listUsers } from '../../lib/org-api'
import { createBinding, listRoles } from '../../lib/workspace-api'
import type { UserSummary } from '../../lib/org-api'
import type { WorkspaceRole } from '../../lib/workspace-api'

interface CreateBindingFormProps {
  token: string
  wsId: string
  onSuccess: () => void
  onCancel: () => void
}

export function CreateBindingForm({ token, wsId, onSuccess, onCancel }: CreateBindingFormProps) {
  const [users, setUsers] = useState<UserSummary[] | null>(null)
  const [roles, setRoles] = useState<WorkspaceRole[] | null>(null)
  const [userId, setUserId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [resourceType, setResourceType] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [bindingType, setBindingType] = useState<'allow' | 'deny'>('allow')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([listUsers(token), listRoles(token, wsId)])
      .then(([u, r]) => { setUsers(u); setRoles(r) })
      .catch(() => { setUsers([]); setRoles([]) })
  }, [token, wsId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || !roleId || !resourceType.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createBinding(token, {
        userId,
        roleId,
        resourceType: resourceType.trim(),
        resourceId: resourceId.trim() || undefined,
        workspaceId: wsId,
        type: bindingType,
      })
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

  const isDeny = bindingType === 'deny'

  return (
    <form
      data-testid="binding-form"
      onSubmit={handleSubmit}
      className={`space-y-4 max-w-sm${isDeny ? ' border border-red-500 bg-[color:var(--gate-danger,#F85149)]/10 rounded p-3' : ''}`}
    >
      <div>
        <label className="block text-xs text-text-secondary mb-1">Tipo de Binding</label>
        <select
          data-testid="select-binding-type"
          value={bindingType}
          onChange={(e) => setBindingType(e.target.value as 'allow' | 'deny')}
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
        >
          <option value="allow">Permitir (allow)</option>
          <option value="deny">Negar (deny)</option>
        </select>
      </div>

      {isDeny && (
        <p data-testid="deny-warning" className="text-xs text-red-400 bg-red-950/30 border border-red-800 rounded px-2 py-1.5">
          Deny bindings têm precedência absoluta sobre qualquer allow.
        </p>
      )}

      <div>
        <label className="block text-xs text-text-secondary mb-1">Usuário</label>
        <select
          data-testid="select-binding-user"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
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
          data-testid="select-binding-role"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
          required
        >
          <option value="">Selecione um role…</option>
          {roles.map((r) => (
            <option key={r._id} value={r._id}>{r.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Resource Type</label>
        <input
          data-testid="input-resource-type"
          type="text"
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          placeholder="ex: document, folder, workspace"
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-text-secondary mb-1">Resource ID <span className="text-text-muted">(opcional)</span></label>
        <input
          data-testid="input-resource-id"
          type="text"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          placeholder="deixe vazio para workspace inteiro"
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
        />
      </div>

      {error && <p className="text-status-deny text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          data-testid="btn-create-binding"
          disabled={loading || !userId || !roleId || !resourceType.trim()}
          className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? 'Criando…' : 'Criar Binding'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  )
}
