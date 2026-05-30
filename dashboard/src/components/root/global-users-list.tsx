import { useState, useEffect } from 'react'
import { Users, X } from 'lucide-react'
import {
  listOrgs,
  listAllUsers,
  suspendUserGlobal,
  revokeAllUserSessions,
  type OrgSummary,
  type GlobalUserSummary,
  type GlobalUsersPage,
} from '../../lib/root-api'
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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function LoadingSkeleton() {
  return (
    <div data-testid="global-users-loading" className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-[9px] border-b border-[#21262D]/30">
          <div className="h-3 w-32 bg-[#161B22] rounded animate-pulse font-mono" />
          <div className="h-3 w-24 bg-[#161B22] rounded animate-pulse" />
          <div className="h-3 w-20 bg-[#161B22] rounded animate-pulse ml-auto" />
        </div>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div data-testid="global-users-empty" className="flex flex-col items-center justify-center py-16 gap-3">
      <Users size={32} className="text-[#484F58]" />
      <p className="text-sm text-[#6E7681]">Nenhum usuário encontrado.</p>
    </div>
  )
}

interface SuspendModalProps {
  user: GlobalUserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function SuspendModal({ user, onConfirm, onCancel, loading }: SuspendModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div data-testid="confirm-suspend-modal" className="bg-[#161B22] border border-[#21262D] rounded-[4px] shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#E6EDF3]">Suspender usuário globalmente</h3>
          <button onClick={onCancel} className="text-[#6E7681] hover:text-[#E6EDF3] cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-[#6E7681]">
          O usuário <span className="font-mono text-[#E6EDF3]">{user.email}</span> será suspenso em todos os workspaces e orgs.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-suspend"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[#6E7681] border border-[#30363D] rounded hover:bg-[#161B22] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            data-testid="btn-confirm-suspend"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-black bg-[#F85149] rounded hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Suspendendo...' : 'Suspender'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface RevokeSessionsModalProps {
  user: GlobalUserSummary
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}

function RevokeSessionsModal({ user, onConfirm, onCancel, loading }: RevokeSessionsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div data-testid="confirm-revoke-sessions-modal" className="bg-[#161B22] border border-[#21262D] rounded-[4px] shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-[#E6EDF3]">Revogar todas as sessões</h3>
          <button onClick={onCancel} className="text-[#6E7681] hover:text-[#E6EDF3] cursor-pointer">
            <X size={16} />
          </button>
        </div>
        <p className="text-[13px] text-[#6E7681]">
          Todas as sessões ativas de <span className="font-mono text-[#E6EDF3]">{user.email}</span> serão encerradas imediatamente.
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="btn-cancel-revoke-sessions"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[#6E7681] border border-[#30363D] rounded hover:bg-[#161B22] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            data-testid="btn-confirm-revoke-sessions"
            onClick={onConfirm}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-black bg-[#F85149] rounded hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'Revogando...' : 'Revogar sessões'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface GlobalUsersListProps {
  token: string
  onViewSessions?: (userId: string) => void
}

export function GlobalUsersList({ token, onViewSessions }: GlobalUsersListProps) {
  const [orgs, setOrgs] = useState<OrgSummary[]>([])
  const [page, setPage] = useState<GlobalUsersPage | undefined>(undefined)
  const [orgFilter, setOrgFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [suspending, setSuspending] = useState<GlobalUserSummary | null>(null)
  const [suspendLoading, setSuspendLoading] = useState(false)
  const [revokingSessions, setRevokingSessions] = useState<GlobalUserSummary | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    listOrgs(token).then(setOrgs).catch(() => {})
  }, [token])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setPage(undefined)
    listAllUsers(token, {
      orgId: orgFilter || undefined,
      status: statusFilter || undefined,
    })
      .then((result) => { if (!cancelled) setPage(result) })
      .catch(() => { if (!cancelled) setPage({ users: [], nextCursor: null, isDone: true }) })
    return () => { cancelled = true }
  }, [token, orgFilter, statusFilter])

  async function handleConfirmSuspend() {
    if (!suspending) return
    setSuspendLoading(true)
    try {
      await suspendUserGlobal(token, suspending._id)
      setSuspending(null)
      setPage(undefined)
      listAllUsers(token, { orgId: orgFilter || undefined, status: statusFilter || undefined })
        .then(setPage)
        .catch(() => {})
    } finally {
      setSuspendLoading(false)
    }
  }

  async function handleConfirmRevokeSessions() {
    if (!revokingSessions) return
    setRevokeLoading(true)
    try {
      await revokeAllUserSessions(token, revokingSessions._id)
      setRevokingSessions(null)
    } finally {
      setRevokeLoading(false)
    }
  }

  const orgMap = Object.fromEntries(orgs.map((o) => [o._id, o.name]))

  return (
    <DenseGridContainer>
      {suspending && (
        <SuspendModal
          user={suspending}
          onConfirm={handleConfirmSuspend}
          onCancel={() => setSuspending(null)}
          loading={suspendLoading}
        />
      )}
      {revokingSessions && (
        <RevokeSessionsModal
          user={revokingSessions}
          onConfirm={handleConfirmRevokeSessions}
          onCancel={() => setRevokingSessions(null)}
          loading={revokeLoading}
        />
      )}

      <DenseGridHeader
        label="Usuários Globais"
        stats={page ? [{ label: 'usuários', value: page.users.length }] : undefined}
      />

      <div className="flex items-center gap-2 px-4 py-2 border-b border-[#21262D] bg-[#0D1117]">
        <select
          data-testid="filter-org"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
          className="h-7 px-2 text-[12px] bg-[#161B22] border border-[#30363D] rounded text-[#E6EDF3] cursor-pointer"
        >
          <option value="">Todas as orgs</option>
          {orgs.map((o) => (
            <option key={o._id} value={o._id}>{o.name}</option>
          ))}
        </select>
        <select
          data-testid="filter-status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-7 px-2 text-[12px] bg-[#161B22] border border-[#30363D] rounded text-[#E6EDF3] cursor-pointer"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="suspended">Suspenso</option>
        </select>
      </div>

      {!page ? (
        <LoadingSkeleton />
      ) : page.users.length === 0 ? (
        <EmptyState />
      ) : (
        <div data-testid="global-users-table">
        <DenseGridTable>
          <DenseGridThead>
            <tr>
              <DenseGridThNum />
              <DenseGridTh>Email</DenseGridTh>
              <DenseGridTh>Org</DenseGridTh>
              <DenseGridTh>Status</DenseGridTh>
              <DenseGridTh>Criado em</DenseGridTh>
              <DenseGridTh align="right">Ações</DenseGridTh>
            </tr>
          </DenseGridThead>
          <tbody>
            {page.users.map((user, i) => (
              <DenseGridRow key={user._id}>
                <DenseGridRowNum index={i} />
                <DenseGridCellStack
                  primary={user.email}
                  secondary={user.orgRole}
                />
                <td className="py-[10px] px-4 text-[12px] font-mono text-[#6E7681]">
                  {orgMap[user.orgId] ?? user.orgId}
                </td>
                <td className="py-[10px] px-4">
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                    user.status === 'active'
                      ? 'bg-[#3FB950]/10 text-[#3FB950]'
                      : 'bg-[#F85149]/10 text-[#F85149]'
                  }`}>
                    {user.status === 'active' ? 'ativo' : 'suspenso'}
                  </span>
                </td>
                <td className="py-[10px] px-4 text-[12px] text-[#6E7681]">
                  {formatDate(user._creationTime)}
                </td>
                <DenseGridActionsCell>
                  <DenseGridActionBtn
                    testId="btn-suspend-user"
                    onClick={() => setSuspending(user)}
                    variant="danger"
                  >
                    Suspender
                  </DenseGridActionBtn>
                  <DenseGridActionBtn
                    testId="btn-revoke-sessions"
                    onClick={() => setRevokingSessions(user)}
                  >
                    Sessões
                  </DenseGridActionBtn>
                  {onViewSessions && (
                    <DenseGridActionBtn
                      testId="btn-view-sessions"
                      onClick={() => onViewSessions(user._id)}
                    >
                      Ver sessões
                    </DenseGridActionBtn>
                  )}
                </DenseGridActionsCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        </div>
      )}

      <DenseGridFooter showing={page?.users.length ?? 0} isDone={page?.isDone} />
    </DenseGridContainer>
  )
}
