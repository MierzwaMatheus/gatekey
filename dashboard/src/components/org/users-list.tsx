import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { Plus } from 'lucide-react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { suspendUser, resetUserPassword, reactivateUser, removeUserFromOrg, type UserSummary } from '../../lib/org-api'
import { UserAccessHistory } from './user-access-history'
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

function formatRelativeTime(ts: number, t: (key: string, opts?: object) => string): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return t('relative_now')
  if (mins < 60) return t('relative_minutes', { count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('relative_hours', { count: hours })
  return t('relative_days', { count: Math.floor(hours / 24) })
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation('users')
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true" className="mb-5">
        <polygon
          points="45,8 75,8 104,37 104,83 75,112 45,112 16,83 16,37"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        <circle cx="52" cy="60" r="10" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" fill="none" />
        <line x1="62" y1="60" x2="80" y2="60" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="74" y1="60" x2="74" y2="66" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
        <line x1="68" y1="60" x2="68" y2="66" stroke="#8B949E" strokeWidth="1" strokeDasharray="4 2" />
      </svg>
      <p className="text-[15px] text-text-primary font-medium mb-1">{t('empty_title')}</p>
      <p className="text-[13px] text-text-secondary mb-5">{t('empty_subtitle')}</p>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
      >
        <Plus size={14} />
        {t('create_button')}
      </button>
    </div>
  )
}

function SuspendModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const { t } = useTranslation('users')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">{t('suspend_title')}</h2>
        <p className="text-[13px] text-text-secondary mb-1">
          {t('suspend_message')}{' '}
          <span className="font-mono text-status-deny">{user.email}</span>?
        </p>
        <p className="text-[12px] text-text-secondary mb-5">
          {t('suspend_warning')}
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {t('common:cancel', { ns: 'common' })}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            {loading ? t('suspend_confirm_loading') : t('suspend_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResetPasswordModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: (password: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const { t } = useTranslation('users')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (newPassword.length < 8) {
      setError(t('reset_password_error_length'))
      return
    }
    onConfirm(newPassword)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">{t('reset_password_title')}</h2>
        <p className="text-[13px] text-text-secondary mb-4">
          {t('reset_password_message')}{' '}
          <span className="font-mono text-text-primary">{user.email}</span>
        </p>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setError('') }}
          placeholder={t('reset_password_placeholder')}
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent mb-1"
        />
        {error && <p className="text-[12px] text-status-deny mb-3">{error}</p>}
        {!error && <div className="mb-3" />}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {t('common:cancel', { ns: 'common' })}
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || newPassword.length < 8}
            className="px-3 py-1.5 text-[13px] text-black bg-accent-primary rounded-button hover:bg-accent-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? t('reset_password_confirm_loading') : t('reset_password_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReactivateModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const { t } = useTranslation('users')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel} data-testid="modal-reactivate">
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">{t('reactivate_title')}</h2>
        <p className="text-[13px] text-text-secondary mb-5">
          {t('reactivate_message')}{' '}
          <span className="font-mono text-status-allow">{user.email}</span>?
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            data-testid="btn-cancel-reactivate"
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {t('common:cancel', { ns: 'common' })}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-testid="btn-confirm-reactivate"
            className="px-3 py-1.5 text-[13px] text-black bg-status-allow rounded-button hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            {loading ? t('reactivate_confirm_loading') : t('reactivate_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RemoveFromOrgModal({
  user,
  onConfirm,
  onCancel,
  loading,
}: {
  user: UserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const { t } = useTranslation('users')
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onCancel} data-testid="modal-remove-org">
      <div
        className="bg-surface-card border border-border-default rounded-card shadow-float p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium text-text-primary mb-2">{t('remove_org_title')}</h2>
        <p className="text-[13px] text-text-secondary mb-5">
          {t('remove_org_message')}{' '}
          <span className="font-mono text-status-deny">{user.email}</span>
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            data-testid="btn-cancel-remove-org"
            className="px-3 py-1.5 text-[13px] text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer disabled:opacity-60"
          >
            {t('common:cancel', { ns: 'common' })}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            data-testid="btn-confirm-remove-org"
            className="px-3 py-1.5 text-[13px] text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-60"
          >
            {loading ? t('remove_org_confirm_loading') : t('remove_org_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface UsersListProps {
  token: string
  orgId: string
  onAddUser: () => void
}

export function UsersList({ token, orgId, onAddUser }: UsersListProps) {
  const { t } = useTranslation('users')
  const [suspendTarget, setSuspendTarget] = useState<UserSummary | null>(null)
  const [resetTarget, setResetTarget] = useState<UserSummary | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<UserSummary | null>(null)
  const [removeOrgTarget, setRemoveOrgTarget] = useState<UserSummary | null>(null)
  const [historyTarget, setHistoryTarget] = useState<UserSummary | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const queryResult = useQuery(
    api.users.listUsersQuery,
    token ? { token, orgId: orgId as Id<'orgs'> } : 'skip',
  )

  const users = queryResult as UserSummary[] | undefined

  async function handleSuspend() {
    if (!suspendTarget) return
    setActionLoading(true)
    try {
      await suspendUser(token, suspendTarget._id)
      setSuspendTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget) return
    setActionLoading(true)
    try {
      await reactivateUser(token, reactivateTarget._id)
      setReactivateTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  async function handleRemoveFromOrg() {
    if (!removeOrgTarget) return
    setActionLoading(true)
    try {
      await removeUserFromOrg(token, removeOrgTarget._id)
      setRemoveOrgTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  async function handleResetPassword(newPassword: string) {
    if (!resetTarget) return
    setActionLoading(true)
    try {
      await resetUserPassword(token, resetTarget._id, newPassword)
      setResetTarget(null)
    } catch {
      // noop
    } finally {
      setActionLoading(false)
    }
  }

  if (users === undefined) {
    return (
      <div className="space-y-2" data-testid="users-loading">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded-[6px]" />
        ))}
      </div>
    )
  }

  if (users.length === 0) {
    return <EmptyState onAdd={onAddUser} />
  }

  return (
    <>
      <DenseGridContainer testId="users-table">
        <DenseGridHeader label={t('header')} stats={[{ label: 'total', value: users.length }]} />
        <DenseGridTable>
          <DenseGridThead>
            <DenseGridThNum />
            <DenseGridTh>{t('col_identifier')}</DenseGridTh>
            <DenseGridTh>{t('col_status')}</DenseGridTh>
            <DenseGridTh>{t('col_role')}</DenseGridTh>
            <DenseGridTh>{t('col_updated')}</DenseGridTh>
            <DenseGridTh align="right">{t('col_actions')}</DenseGridTh>
          </DenseGridThead>
          <tbody>
            {users.map((user, i) => (
              <DenseGridRow key={user._id}>
                <DenseGridRowNum index={i} />
                <DenseGridCellStack primary={user.email} />
                <DenseGridCell>
                  <DenseGridStatusBadge
                    value={user.status}
                    type={user.status === 'active' ? 'allow' : 'deny'}
                  />
                </DenseGridCell>
                <DenseGridCell>
                  <span className="text-[11px] text-[#8B949E]">{user.orgRole}</span>
                </DenseGridCell>
                <DenseGridCell>
                  <span className="text-[11px] text-[#6E7681]">{formatRelativeTime(user.updatedAt, t)}</span>
                </DenseGridCell>
                <DenseGridActionsCell>
                  {user.status === 'active' && (
                    <DenseGridActionBtn
                      variant="danger"
                      onClick={() => setSuspendTarget(user)}
                      testId={`btn-suspend-${user._id}`}
                    >
                      {t('action_suspend')}
                    </DenseGridActionBtn>
                  )}
                  {user.status === 'suspended' && (
                    <DenseGridActionBtn
                      onClick={() => setReactivateTarget(user)}
                      testId={`btn-reactivate-${user._id}`}
                    >
                      {t('action_reactivate')}
                    </DenseGridActionBtn>
                  )}
                  <DenseGridActionBtn
                    variant="danger"
                    onClick={() => setRemoveOrgTarget(user)}
                    testId={`btn-remove-org-${user._id}`}
                  >
                    {t('action_remove_org')}
                  </DenseGridActionBtn>
                  <DenseGridActionBtn onClick={() => setResetTarget(user)}>
                    {t('action_reset_password')}
                  </DenseGridActionBtn>
                  <DenseGridActionBtn
                    onClick={() => setHistoryTarget(user)}
                    testId={`btn-history-${user._id}`}
                  >
                    {t('action_view_history', 'Ver histórico')}
                  </DenseGridActionBtn>
                </DenseGridActionsCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        <DenseGridFooter showing={users.length} />
      </DenseGridContainer>

      {suspendTarget && (
        <SuspendModal
          user={suspendTarget}
          onConfirm={handleSuspend}
          onCancel={() => setSuspendTarget(null)}
          loading={actionLoading}
        />
      )}

      {reactivateTarget && (
        <ReactivateModal
          user={reactivateTarget}
          onConfirm={handleReactivate}
          onCancel={() => setReactivateTarget(null)}
          loading={actionLoading}
        />
      )}

      {removeOrgTarget && (
        <RemoveFromOrgModal
          user={removeOrgTarget}
          onConfirm={handleRemoveFromOrg}
          onCancel={() => setRemoveOrgTarget(null)}
          loading={actionLoading}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onConfirm={handleResetPassword}
          onCancel={() => setResetTarget(null)}
          loading={actionLoading}
        />
      )}

      {historyTarget && (
        <UserAccessHistory
          userId={historyTarget._id}
          userName={historyTarget.email}
          token={token}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </>
  )
}
