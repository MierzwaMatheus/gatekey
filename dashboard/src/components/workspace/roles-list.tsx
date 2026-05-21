import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { listRoles, deleteRole, duplicateRole, listCapabilities, type WorkspaceRole } from '../../lib/workspace-api'
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
  const { t } = useTranslation('roles')
  const [roles, setRoles] = useState<WorkspaceRole[] | null>(null)
  const [capNames, setCapNames] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<WorkspaceRole | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
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

  async function handleDuplicate(role: WorkspaceRole) {
    setDuplicateError(null)
    try {
      const newRole = await duplicateRole(token, role._id, wsId)
      setRoles((prev) => prev ? [...prev, { _id: newRole.id, name: newRole.name, isBase: newRole.isBase, capabilities: newRole.capabilities }] : prev)
      setEditingRoleId(newRole.id)
      setEditingName(newRole.name)
    } catch (err) {
      setDuplicateError((err as Error).message)
    }
  }

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
        <p className="text-text-muted text-sm">{t('empty')}</p>
      </div>
    )
  }

  return (
    <>
      <DenseGridContainer testId="roles-list">
        <DenseGridHeader label={t('header')} stats={[{ label: 'total', value: roles.length }]} />
        <DenseGridTable>
          <DenseGridThead>
            <DenseGridThNum />
            <DenseGridTh>{t('col_name')}</DenseGridTh>
            <DenseGridTh>{t('col_type')}</DenseGridTh>
            <DenseGridTh>{t('col_capabilities')}</DenseGridTh>
            <DenseGridTh align="right">{t('col_actions')}</DenseGridTh>
          </DenseGridThead>
          <tbody>
            {roles.map((r, i) => (
              <DenseGridRow key={r._id} testId={`role-row-${r._id}`}>
                <DenseGridRowNum index={i} />
                <DenseGridCellStack
                  primary={
                    editingRoleId === r._id ? (
                      <input
                        data-testid={`inline-rename-${r._id}`}
                        className="bg-transparent border-b border-border-default text-text-primary text-sm focus:outline-none"
                        value={editingName}
                        autoFocus
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => {
                          setRoles((prev) => prev?.map((role) =>
                            role._id === r._id ? { ...role, name: editingName || role.name } : role
                          ) ?? null)
                          setEditingRoleId(null)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                          if (e.key === 'Escape') { setEditingName(r.name); setEditingRoleId(null) }
                        }}
                      />
                    ) : r.name
                  }
                />
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
                    <>
                      <DenseGridActionBtn
                        variant="neutral"
                        testId={`btn-duplicate-${r._id}`}
                        onClick={() => handleDuplicate(r)}
                      >
                        {t('action_duplicate')}
                      </DenseGridActionBtn>
                      <DenseGridActionBtn
                        variant="danger"
                        testId={`btn-delete-${r._id}`}
                        onClick={() => { setDeleteTarget(r); setDeleteError(null) }}
                      >
                        {t('action_delete')}
                      </DenseGridActionBtn>
                    </>
                  )}
                </DenseGridActionsCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        <DenseGridFooter showing={roles.length} />
      </DenseGridContainer>

      {duplicateError && (
        <div
          data-testid="duplicate-role-error"
          className="mt-2 text-status-deny text-xs"
        >
          {duplicateError.includes('QuotaExceeded')
            ? t('duplicate_quota_error')
            : duplicateError}
        </div>
      )}

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
              {t('delete_title', { name: deleteTarget.name })}
            </p>
            {deleteError && (
              <p data-testid="delete-role-error" className="text-status-deny text-xs mb-3">
                {deleteError.includes('active_bindings')
                  ? t('delete_warning')
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
                {actionLoading ? t('delete_confirm_loading') : t('delete_confirm')}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-button hover:bg-surface-hover cursor-pointer"
              >
                {t('common:cancel', { ns: 'common' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
