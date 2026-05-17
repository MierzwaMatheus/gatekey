import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { deleteBinding, type WorkspaceBinding } from '../../lib/workspace-api'

interface BindingsListProps {
  token: string
  orgId: string
  wsId: string
}

export function BindingsList({ token, orgId, wsId }: BindingsListProps) {
  const [revokeTarget, setRevokeTarget] = useState<WorkspaceBinding | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const queryResult = useQuery(
    api.bindings.listBindingsQuery,
    token
      ? { token, orgId: orgId as Id<'orgs'>, workspaceId: wsId as Id<'workspaces'> }
      : 'skip',
  )

  const bindings = queryResult as WorkspaceBinding[] | undefined

  async function handleRevoke() {
    if (!revokeTarget) return
    setActionLoading(true)
    try {
      await deleteBinding(token, revokeTarget._id)
      setRevokeTarget(null)
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
        <p className="text-text-muted text-sm">Nenhum binding neste workspace.</p>
      </div>
    )
  }

  return (
    <>
      <div data-testid="bindings-list">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Usuário</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Role</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Resource Type</th>
              <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Resource ID</th>
              <th className="py-2 px-3" />
            </tr>
          </thead>
          <tbody>
            {bindings.map((b) => (
              <tr
                key={b._id}
                data-testid={`binding-row-${b._id}`}
                className="border-b border-border-default hover:bg-surface-hover group"
              >
                <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">{b.userId}</td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded-pill bg-surface-elevated text-text-secondary text-xs">
                    {b.roleName ?? b.roleId}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-text-primary text-xs">{b.resourceType}</td>
                <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">
                  {b.resourceId ?? 'workspace inteiro'}
                </td>
                <td className="py-2.5 px-3">
                  <button
                    data-testid={`btn-revoke-${b._id}`}
                    onClick={() => setRevokeTarget(b)}
                    className="opacity-0 group-hover:opacity-100 px-2 py-1 text-[11px] text-status-deny border border-border-default rounded hover:bg-surface-hover cursor-pointer transition-opacity"
                  >
                    Revogar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              Revogar binding de <strong>{revokeTarget.roleId}</strong> em{' '}
              <strong>{revokeTarget.resourceId ?? 'workspace inteiro'}</strong>?
            </p>
            <div className="flex gap-2">
              <button
                data-testid="btn-confirm-revoke"
                onClick={handleRevoke}
                disabled={actionLoading}
                className="px-3 py-1.5 text-xs bg-status-deny text-white rounded-button disabled:opacity-60 cursor-pointer"
              >
                {actionLoading ? 'Revogando…' : 'Revogar'}
              </button>
              <button
                onClick={() => setRevokeTarget(null)}
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
