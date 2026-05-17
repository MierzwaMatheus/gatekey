import { useState, useEffect, useRef } from 'react'
import { listRoles, deleteRole, listCapabilities, type WorkspaceRole } from '../../lib/workspace-api'

interface RolesListProps {
  token: string
  wsId: string
  refreshKey?: number
}

export function RolesList({ token, wsId, refreshKey }: RolesListProps) {
  const [roles, setRoles] = useState<WorkspaceRole[] | null>(null)
  const [capNames, setCapNames] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceRole | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setRoles(null)

    Promise.all([listRoles(token, wsId), listCapabilities(token)])
      .then(([r, caps]) => {
        if (!ac.signal.aborted) {
          const nameMap: Record<string, string> = {}
          caps.capabilities.forEach((c) => { nameMap[c._id] = c.name })
          setRoles(r)
          setCapNames(nameMap)
        }
      })
      .catch(() => { if (!ac.signal.aborted) setRoles([]) })

    return () => ac.abort()
  }, [token, wsId, refreshKey])

  async function handleDelete() {
    if (!deleteTarget) return
    setActionLoading(true)
    setDeleteError(null)
    try {
      await deleteRole(token, deleteTarget._id)
      setRoles((prev) => prev?.filter((r) => r._id !== deleteTarget._id) ?? null)
      setDeleteTarget(null)
    } catch (err) {
      setDeleteError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  if (roles === null) {
    return (
      <div data-testid="roles-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (roles.length === 0) {
    return (
      <div data-testid="roles-empty" className="text-center py-12">
        <p className="text-text-muted text-sm">Nenhum role customizado neste workspace.</p>
      </div>
    )
  }

  return (
    <>
      <div data-testid="roles-list">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Nome</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Tipo</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Capabilities</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr
                key={r._id}
                data-testid={`role-row-${r._id}`}
                className="border-b border-border-default hover:bg-surface-hover group"
              >
                <td className="py-2.5 px-3 text-text-primary font-medium">{r.name}</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-pill text-xs bg-surface-elevated text-text-secondary">
                    {r.isBase ? 'base' : 'custom'}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-text-secondary text-xs">
                  {r.capabilities.map((capId) => capNames[capId] ?? capId).join(', ') || '—'}
                </td>
                <td className="py-2.5 px-3">
                  {!r.isBase && (
                    <button
                      data-testid={`btn-delete-${r._id}`}
                      onClick={() => { setDeleteTarget(r); setDeleteError(null) }}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[11px] text-status-deny border border-border-default rounded hover:bg-surface-hover cursor-pointer transition-opacity"
                    >
                      Deletar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            data-testid="delete-role-modal"
            className="bg-surface-card border border-border-default rounded-card p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary text-sm mb-2">
              Deletar role <strong>{deleteTarget.name}</strong>?
            </p>
            <p className="text-text-secondary text-xs mb-4">
              Esta ação é irreversível. Usuários com este role perderão as permissões associadas.
            </p>
            {deleteError && (
              <p data-testid="delete-role-error" className="text-status-deny text-xs mb-3">
                {deleteError.includes('active_bindings')
                  ? 'Existem bindings ativos usando este role. Remova-os antes de deletar.'
                  : deleteError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                data-testid="btn-confirm-delete-role"
                onClick={handleDelete}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-status-deny text-white rounded-button disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? 'Deletando…' : 'Deletar'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
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
