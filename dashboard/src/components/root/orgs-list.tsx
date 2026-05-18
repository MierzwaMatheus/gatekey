import { useEffect, useState } from 'react'
import { Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { listOrgs, type OrgSummary } from '../../lib/root-api'
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
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

interface OrgsListProps {
  token: string
  onSelectOrg: (orgId: string) => void
  refreshKey?: number
}

function statusType(status: OrgSummary['status']): 'allow' | 'deny' | 'neutral' {
  if (status === 'active') return 'allow'
  if (status === 'deleted') return 'deny'
  return 'neutral'
}

function EmptyState() {
  const { t } = useTranslation('common')
  return (
    <div data-testid="orgs-empty" className="flex flex-col items-center justify-center py-20 gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        {/* Octógono outline */}
        <polygon
          points="60,10 100,30 110,70 90,110 30,110 10,70 20,30 60,10"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        {/* Chave pontilhada ausente */}
        <rect
          x="42" y="52" width="36" height="16" rx="8"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
        <rect
          x="68" y="58" width="8" height="6" rx="2"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
      </svg>
      <p className="text-[15px] text-text-primary">{t('orgs.empty_title')}</p>
      <p className="text-[13px] text-text-secondary">{t('orgs.empty_subtitle')}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div data-testid="orgs-loading" className="space-y-px">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-[9px] border-b border-border-default/30">
          <div className="h-3 w-40 bg-surface-elevated rounded animate-pulse" />
          <div className="h-5 w-16 bg-surface-elevated rounded-pill animate-pulse" />
          <div className="h-3 w-8 bg-surface-elevated rounded animate-pulse ml-auto" />
          <div className="h-3 w-8 bg-surface-elevated rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

export function OrgsList({ token, onSelectOrg, refreshKey = 0 }: OrgsListProps) {
  const { t } = useTranslation('common')
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setOrgs(null)
    setError(false)
    listOrgs(token)
      .then((data) => { if (!cancelled) setOrgs(data) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [token, refreshKey])

  if (error) {
    return (
      <div data-testid="orgs-error" className="flex items-center justify-center py-12">
        <p className="text-sm text-status-deny">{t('orgs.error')}</p>
      </div>
    )
  }

  if (orgs === null) return <LoadingSkeleton />
  if (orgs.length === 0) return <EmptyState />

  return (
    <DenseGridContainer>
      <DenseGridHeader label={t('orgs.label')} stats={[{ label: 'total', value: orgs.length }]} />
      <DenseGridTable>
        <DenseGridThead>
          <DenseGridThNum />
          <DenseGridTh>{t('orgs.col_name')}</DenseGridTh>
          <DenseGridTh>{t('orgs.col_status')}</DenseGridTh>
          <DenseGridTh>{t('orgs.col_users')}</DenseGridTh>
          <DenseGridTh>{t('orgs.col_workspaces')}</DenseGridTh>
          <DenseGridTh>{t('orgs.col_activity')}</DenseGridTh>
        </DenseGridThead>
        <tbody>
          {orgs.map((org, i) => (
            <DenseGridRow key={org._id} testId={`org-row-${org._id}`}>
              <DenseGridRowNum index={i} />
              <DenseGridCellStack
                primary={
                  <button
                    onClick={() => onSelectOrg(org._id)}
                    className="flex items-center gap-1.5 text-[13px] font-mono text-[#E6EDF3] hover:text-[#58A6FF] transition-colors cursor-pointer text-left"
                  >
                    <Building2 size={12} className="text-[#6E7681] flex-shrink-0" />
                    {org.name}
                  </button>
                }
              />
              <DenseGridCell>
                <span data-testid={`status-${org._id}`}>
                  <DenseGridStatusBadge value={org.status} type={statusType(org.status)} />
                </span>
              </DenseGridCell>
              <DenseGridCell>
                <span data-testid={`users-count-${org._id}`} className="text-[11px] text-[#8B949E]">
                  {org.usersCount}
                </span>
              </DenseGridCell>
              <DenseGridCell>
                <span data-testid={`workspaces-count-${org._id}`} className="text-[11px] text-[#8B949E]">
                  {org.workspacesCount}
                </span>
              </DenseGridCell>
              <DenseGridCell>
                <span className="text-[11px] text-[#6E7681]">{formatRelative(org.updatedAt)}</span>
              </DenseGridCell>
            </DenseGridRow>
          ))}
        </tbody>
      </DenseGridTable>
      <DenseGridFooter showing={orgs.length} />
    </DenseGridContainer>
  )
}
