import { useState, useEffect } from 'react'
import { createResourceType, listResourceTypes, type ResourceType } from '../../lib/workspace-api'

interface CreateResourceTypeFormProps {
  token: string
  onSuccess: () => void
  onCancel: () => void
}

export function CreateResourceTypeForm({ token, onSuccess, onCancel }: CreateResourceTypeFormProps) {
  const [existingTypes, setExistingTypes] = useState<ResourceType[]>([])
  const [name, setName] = useState('')
  const [useInheritance, setUseInheritance] = useState(false)
  const [inheritsFrom, setInheritsFrom] = useState('')
  const [inheritanceMode, setInheritanceMode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listResourceTypes(token)
      .then(setExistingTypes)
      .catch(() => setExistingTypes([]))
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createResourceType(token, {
        name: name.trim(),
        inheritsFrom: useInheritance && inheritsFrom ? inheritsFrom : undefined,
        inheritanceMode: useInheritance && inheritanceMode ? inheritanceMode : undefined,
      })
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
      <div>
        <label className="block text-xs text-text-secondary mb-1">Nome</label>
        <input
          data-testid="input-rt-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ex: document, folder, report"
          className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none font-mono"
          required
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          data-testid="toggle-inheritance"
          type="checkbox"
          id="toggle-inheritance"
          checked={useInheritance}
          onChange={(e) => setUseInheritance(e.target.checked)}
          className="accent-accent-primary"
        />
        <label htmlFor="toggle-inheritance" className="text-sm text-text-primary cursor-pointer">
          Herdar permissões de outro tipo
        </label>
      </div>

      {useInheritance && (
        <>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Tipo Pai</label>
            <select
              data-testid="select-parent-type"
              value={inheritsFrom}
              onChange={(e) => setInheritsFrom(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
            >
              <option value="">Selecione…</option>
              {existingTypes.map((rt) => (
                <option key={rt._id} value={rt.name}>{rt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-secondary mb-1">Modo de Herança</label>
            <input
              data-testid="input-inheritance-mode"
              type="text"
              value={inheritanceMode}
              onChange={(e) => setInheritanceMode(e.target.value)}
              placeholder="ex: full, partial"
              className="w-full px-3 py-2 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
            />
          </div>
        </>
      )}

      {error && <p className="text-status-deny text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          data-testid="btn-create-resource-type"
          disabled={loading || !name.trim()}
          className="px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover disabled:opacity-60 transition-colors cursor-pointer"
        >
          {loading ? 'Registrando…' : 'Registrar'}
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
