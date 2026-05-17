import { useState, useEffect, useRef } from 'react'
import { listMembers, type WorkspaceMember } from '../../lib/workspace-api'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface MembersListProps {
  token: string
  wsId: string
  onAddMember: () => void
  refreshKey?: number
}

export function MembersList({ token, wsId, onAddMember, refreshKey }: MembersListProps) {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null)
  const [error, setError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setMembers(null)
    setError(false)

    listMembers(token, wsId)
      .then((data) => { if (!ac.signal.aborted) setMembers(data) })
      .catch(() => { if (!ac.signal.aborted) setError(true) })

    return () => ac.abort()
  }, [token, wsId, refreshKey])

  if (error) {
    return (
      <div data-testid="members-error" className="text-status-deny text-sm py-4">
        Erro ao carregar membros.
      </div>
    )
  }

  if (members === null) {
    return (
      <div data-testid="members-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div data-testid="members-empty" className="text-center py-12">
        <p className="text-text-muted text-sm">Nenhum membro neste workspace.</p>
        <button
          onClick={onAddMember}
          className="mt-3 px-3 py-1.5 text-xs bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors cursor-pointer"
        >
          Adicionar membro
        </button>
      </div>
    )
  }

  return (
    <div data-testid="members-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Nome</th>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Email</th>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Role</th>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Adicionado</th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.userId}
              data-testid={`member-row-${m.userId}`}
              className="border-b border-border-default hover:bg-surface-hover group"
            >
              <td className="py-2.5 px-3 text-text-primary font-medium">{m.userName}</td>
              <td className="py-2.5 px-3 text-text-secondary font-mono text-xs">{m.userEmail}</td>
              <td className="py-2.5 px-3">
                <span className="px-2 py-0.5 rounded-pill bg-surface-elevated text-text-secondary text-xs">
                  {m.roleName}
                </span>
              </td>
              <td className="py-2.5 px-3 text-text-muted text-xs">{relativeTime(m.addedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
