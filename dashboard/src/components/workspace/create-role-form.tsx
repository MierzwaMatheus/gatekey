import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { createRole, listCapabilities, getRoleActiveUserCount, updateRoleCapabilities } from '../../lib/workspace-api'
import type { WorkspaceCapability } from '../../lib/workspace-api'

interface CreateRoleFormProps {
  token: string
  wsId: string
  onSuccess: () => void
  onCancel: () => void
  roleId?: string
  initialCapabilities?: string[]
}

export function CreateRoleForm({ token, wsId, onSuccess, onCancel, roleId, initialCapabilities }: CreateRoleFormProps) {
  const { t } = useTranslation('roles')
  const isEditMode = Boolean(roleId)
  const [capabilities, setCapabilities] = useState<WorkspaceCapability[] | null>(null)
  const [name, setName] = useState('')
  const [selectedCaps, setSelectedCaps] = useState<Set<string>>(new Set(initialCapabilities ?? []))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ affectedCount: number } | null>(null)

  useEffect(() => {
    listCapabilities(token)
      .then(({ capabilities: caps }) => setCapabilities(caps))
      .catch(() => setCapabilities([]))
  }, [token])

  function toggleCap(capId: string) {
    setSelectedCaps((prev) => {
      const next = new Set(prev)
      if (next.has(capId)) next.delete(capId)
      else next.add(capId)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isEditMode) {
      setLoading(true)
      setError(null)
      try {
        const { count } = await getRoleActiveUserCount(token, roleId!)
        if (count > 0) {
          setConfirmDialog({ affectedCount: count })
        } else {
          await saveCapabilities()
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
      return
    }
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createRole(token, { name: name.trim(), workspaceId: wsId })
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function saveCapabilities() {
    await updateRoleCapabilities(token, roleId!, { capabilityIds: Array.from(selectedCaps), workspaceId: wsId })
    onSuccess()
  }

  async function handleConfirmEdit() {
    setLoading(true)
    setError(null)
    try {
      await saveCapabilities()
      setConfirmDialog(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!capabilities) {
    return <div className="text-text-muted text-sm py-2">Carregando capabilities…</div>
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      {!isEditMode && (
        <div>
          <label className="block text-xs text-text-secondary mb-1">Nome do Role</label>
          <input
            data-testid="input-role-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('create_name_placeholder')}
            className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
            required
          />
        </div>
      )}

      <div>
        <p className="text-xs text-text-secondary mb-2">Capabilities</p>
        <div className="space-y-1">
          {capabilities.map((cap) => (
            <label key={cap._id} className="flex items-center gap-2 cursor-pointer">
              <input
                data-testid={`cap-check-${cap._id}`}
                type="checkbox"
                checked={selectedCaps.has(cap._id)}
                onChange={() => toggleCap(cap._id)}
                className="accent-accent-primary"
              />
              <span className="text-sm text-text-primary font-mono">{cap.name}</span>
              <span className="text-xs text-text-muted">{cap.description}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-status-deny text-xs">{error}</p>}

      {confirmDialog && (
        <div data-testid="role-edit-confirm-dialog" className="p-3 bg-surface-elevated border border-border-default rounded-input space-y-3">
          <p className="text-sm text-text-primary">
            Esta alteração afeta {confirmDialog.affectedCount} usuário(s) imediatamente. Deseja continuar?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="btn-confirm-edit"
              onClick={handleConfirmEdit}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
            >
              Confirmar
            </button>
            <button
              type="button"
              data-testid="btn-cancel-edit"
              onClick={() => setConfirmDialog(null)}
              className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {isEditMode ? (
          <button
            type="submit"
            data-testid="btn-save-role"
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? t('create_submit_loading') : 'Salvar'}
          </button>
        ) : (
          <button
            type="submit"
            data-testid="btn-create-role"
            disabled={loading || !name.trim()}
            className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? t('create_submit_loading') : t('create_submit')}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
        >
          {t('common:cancel', { ns: 'common' })}
        </button>
      </div>
    </form>
  )
}
