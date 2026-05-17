import { useState, useEffect, useRef } from 'react'
import { listRoles, deleteRole, listCapabilities, type WorkspaceRole } from '../../lib/workspace-api'
import {
  DenseGridContainer,
  DenseGridHeader,
  DenseGridTable,
  DenseGridThead,
  DenseGridTh,
  DenseGridThNum,
  DenseGridRow,
  DenseGridRowNum,
  DenseGridCellStack,
  DenseGridCell,
  DenseGridActionsCell,
  DenseGridActionBtn,
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

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
      <DenseGridContainer testId="roles-list">
        <DenseGridHeader label="Roles" stats={[{ label: 'total', value: roles.length }]} />
        <DenseGridTable>
          <DenseGridThead>
            <DenseGridThNum />
            <DenseGridTh>Nome</DenseGridTh>
            <DenseGridTh>Tipo</DenseGridTh>
            <DenseGridTh>Capabilities</DenseGridTh>
            <DenseGridTh align="right">Ações</DenseGridTh>
          </DenseGridThead>
          <tbody>
            {roles.map((r, i) => (
              <DenseGridRow key={r._id} testId={`role-row-${r._id}`}>
                <DenseGridRowNum index={i} />
                <DenseGridCellStack primary={r.name} />
                <DenseGridCell>
                  <DenseGridStatusBadge value={r.isBase ? 'base' : 'custom'} type="neutral" />
                </DenseGridCell>
                <DenseGridCell>
                  <span className="text-[11px] text-[#6E7681]">
                    {r.capabilities.map((capId) => capNames[capId] ?? capId).join(', ') || '—'}
                  </span>
                </DenseGridCell>
                <DenseGridActionsCell>
                  {!r.isBase && (
                    <DenseGridActionBtn
                      variant="danger"
                      testId={`btn-delete-${r._id}`}
                      onClick={() => { setDeleteTarget(r); setDeleteError(null) }}
                    >
                      Deletar
                    </DenseGridActionBtn>
                  )}
                </DenseGridActionsCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        <DenseGridFooter showing={roles.length} />
      </DenseGridContainer>

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
