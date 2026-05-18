import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { listBindings, deleteBinding, type WorkspaceBinding } from '../../lib/workspace-api'
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
  DenseGridActionsCell,
  DenseGridActionBtn,
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

interface BindingsListProps {
  token: string
  orgId: string
  wsId: string
}

export function BindingsList({ token, orgId: _orgId, wsId }: BindingsListProps) {
  const { t } = useTranslation('bindings')
  const [revokeTarget, setRevokeTarget] = useState<WorkspaceBinding | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [bindings, setBindings] = useState<WorkspaceBinding[] | undefined>(undefined)

  useEffect(() => {
    if (!token) return
    listBindings(token, wsId).then(setBindings).catch(() => setBindings([]))
  }, [token, wsId])

  async function handleRevoke() {
    if (!revokeTarget) return
    setActionLoading(true)
    try {
      await deleteBinding(token, revokeTarget._id)
      setRevokeTarget(null)
      const updated = await listBindings(token, wsId)
      setBindings(updated)
    } finally {
      setActionLoading(false)
    }
  }

  if (bindings === undefined) {
    return (
      <div data-testid="bindings-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (bindings.length === 0) {
    return (
      <div data-testid="bindings-empty" className="text-center py-12">
        <p className="text-text-muted text-sm">{t('empty')}</p>
      </div>
    )
  }

  return (
    <>
      <DenseGridContainer testId="bindings-list">
        <DenseGridHeader label={t('header')} stats={[{ label: 'total', value: bindings.length }]} />
        <DenseGridTable>
          <DenseGridThead>
            <DenseGridThNum />
            <DenseGridTh>{t('col_user')}</DenseGridTh>
            <DenseGridTh>{t('col_role')}</DenseGridTh>
            <DenseGridTh>{t('col_resource_type')}</DenseGridTh>
            <DenseGridTh>{t('col_resource_id')}</DenseGridTh>
            <DenseGridTh align="right">{t('col_actions')}</DenseGridTh>
          </DenseGridThead>
          <tbody>
            {bindings.map((b, i) => (
              <DenseGridRow key={b._id} testId={`binding-row-${b._id}`}>
                <DenseGridRowNum index={i} />
                <DenseGridCellStack primary={b.userId} />
                <DenseGridCellStack
                  primary={<DenseGridStatusBadge value={b.roleName ?? b.roleId} type="neutral" />}
                />
                <DenseGridCellStack primary={b.resourceType} />
                <DenseGridCellStack
                  primary={
                    <span className="text-[11px] text-[#6E7681]">{b.resourceId ?? t('resource_id_workspace')}</span>
                  }
                />
                <DenseGridActionsCell>
                  <DenseGridActionBtn
                    variant="danger"
                    testId={`btn-revoke-${b._id}`}
                    onClick={() => setRevokeTarget(b)}
                  >
                    {t('action_revoke')}
                  </DenseGridActionBtn>
                </DenseGridActionsCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        <DenseGridFooter showing={bindings.length} />
      </DenseGridContainer>

      {revokeTarget && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setRevokeTarget(null)}
        >
          <div
            data-testid="revoke-binding-modal"
            className="bg-surface-card border border-border-default rounded-card p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-text-primary text-sm mb-4">
              {t('action_revoke')} binding: <strong>{revokeTarget.roleId}</strong> —{' '}
              <strong>{revokeTarget.resourceId ?? t('resource_id_workspace')}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                data-testid="btn-confirm-revoke"
                onClick={handleRevoke}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-status-deny text-white rounded-button disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? '…' : t('action_revoke')}
              </button>
              <button
                onClick={() => setRevokeTarget(null)}
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
