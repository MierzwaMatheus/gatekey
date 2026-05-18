import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from 'convex/react'
import { MonitorDot, X } from 'lucide-react'
import { api } from '@convex/_generated/api'
import type { Id } from '@convex/_generated/dataModel'
import { revokeSession, type SessionSummary } from '../../lib/root-api'
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
  DenseGridFooter,
} from '../ui/dense-grid'


function formatExpiry(ts: number): string {
  const diff = ts - Date.now()
  if (diff <= 0) return 'expirada'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `expira em ${mins}m`
  return `expira em ${Math.floor(mins / 60)}h`
}

function LoadingSkeleton() {
  return (
    <div data-testid="sessions-loading" className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-[9px] border-b border-border-default/30">
          <div className="h-3 w-32 bg-surface-elevated rounded animate-pulse font-mono" />
          <div className="h-3 w-24 bg-surface-elevated rounded animate-pulse" />
          <div className="h-3 w-20 bg-surface-elevated rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation('audit')
  return (
    <div data-testid="sessions-empty" className="flex flex-col items-center justify-center py-16 gap-3">
      <MonitorDot size={32} className="text-text-secondary" />
      <p className="text-sm text-text-secondary">{t('sessions_empty')}</p>
    </div>
  )
}

interface RevokeModalProps {
  session: SessionSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function RevokeModal({ session, onConfirm, onCancel, loading }: RevokeModalProps) {
  const { t } = useTranslation('audit')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div data-testid="modal-revoke-session" className="bg-surface-card border border-border-default rounded-card shadow-float w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">{t('sessions_revoke')}</h3>
          <button onClick={onCancel} className="text-text-secondary hover:text-text-primary cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-text-secondary">
          A sessão do usuário{' '}
          <span className="font-mono text-text-primary">{session.userId}</span>{' '}
          será revogada imediatamente.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-revoke"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-hover transition-colors cursor-pointer"
          >
            {t('common:cancel', { ns: 'common' })}
          </button>
          <button
            data-testid="btn-confirm-revoke"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-black bg-status-deny rounded-button hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {loading ? t('sessions_revoke_loading') : t('sessions_revoke_confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface SessionsListProps {
  token: string
}

export function SessionsList({ token }: SessionsListProps) {
  const { t } = useTranslation('audit')
  const [userIdFilter, setUserIdFilter] = useState('')
  const [orgIdFilter, setOrgIdFilter] = useState('')
  const [revoking, setRevoking] = useState<SessionSummary | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  const queryResult = useQuery(
    api.sessions.listSessionsQuery,
    token
      ? {
          token,
          userId: (userIdFilter || undefined) as Id<'users'> | undefined,
        }
      : 'skip',
  )

  const sessions = queryResult as SessionSummary[] | undefined

  const filtered = sessions?.filter((s) =>
    (!orgIdFilter || s.orgId === orgIdFilter),
  )

  async function handleRevoke() {
    if (!revoking) return
    setRevokeLoading(true)
    try {
      await revokeSession(token, revoking._id)
      setRevoking(null)
    } finally {
      setRevokeLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 pb-3 border-b border-border-default">
        <input
          data-testid="filter-user-id"
          type="text"
          placeholder={t('filter_user')}
          value={userIdFilter}
          onChange={(e) => setUserIdFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 text-[12px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
        <input
          data-testid="filter-org-id"
          type="text"
          placeholder={t('filter_org')}
          value={orgIdFilter}
          onChange={(e) => setOrgIdFilter(e.target.value)}
          className="flex-1 px-3 py-1.5 text-[12px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
      </div>

      {filtered === undefined ? (
        <LoadingSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <DenseGridContainer>
          <DenseGridHeader
            label="Sessions / Live"
            stats={[{ label: t('sessions_label_active'), value: filtered.length }]}
          />
          <DenseGridTable>
            <DenseGridThead>
              <DenseGridThNum />
              <DenseGridTh>{t('sessions_col_user')}</DenseGridTh>
              <DenseGridTh>{t('sessions_col_ip')}</DenseGridTh>
              <DenseGridTh>{t('sessions_col_device')}</DenseGridTh>
              <DenseGridTh>{t('sessions_col_expires')}</DenseGridTh>
              <DenseGridTh align="right">{t('sessions_col_actions')}</DenseGridTh>
            </DenseGridThead>
            <tbody>
              {filtered.map((session, i) => (
                <DenseGridRow key={session._id} testId={`session-row-${session._id}`}>
                  <DenseGridRowNum index={i} />
                  <DenseGridCellStack
                    primary={
                      <span data-testid={`session-userid-${session._id}`}>{session.userId}</span>
                    }
                  />
                  <DenseGridCellStack
                    primary={
                      <span data-testid={`session-ip-${session._id}`} className="text-[11px] text-[#8B949E]">
                        {session.ip ?? '—'}
                      </span>
                    }
                  />
                  <DenseGridCellStack
                    primary={
                      <span className="text-[11px] text-[#6E7681]">
                        {session.deviceInfo ? session.deviceInfo.slice(0, 24) : '—'}
                      </span>
                    }
                  />
                  <DenseGridCellStack
                    primary={
                      <span className="text-[11px] text-[#6E7681]">{formatExpiry(session.expiresAt)}</span>
                    }
                  />
                  <DenseGridActionsCell>
                    <DenseGridActionBtn
                      variant="danger"
                      testId={`btn-revoke-${session._id}`}
                      onClick={() => setRevoking(session)}
                    >
                      {t('sessions_revoke_confirm')}
                    </DenseGridActionBtn>
                  </DenseGridActionsCell>
                </DenseGridRow>
              ))}
            </tbody>
          </DenseGridTable>
          <DenseGridFooter showing={filtered.length} />
        </DenseGridContainer>
      )}

      {revoking && (
        <RevokeModal
          session={revoking}
          onConfirm={handleRevoke}
          onCancel={() => setRevoking(null)}
          loading={revokeLoading}
        />
      )}
    </div>
  )
}
