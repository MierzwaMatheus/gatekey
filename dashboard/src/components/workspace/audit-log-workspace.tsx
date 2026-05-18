import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { listWorkspaceAuditLog, type AuditEvent } from '../../lib/workspace-api'
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
  DenseGridStatusBadge,
  DenseGridFooter,
} from '../ui/dense-grid'

interface AuditLogWorkspaceProps {
  token: string
  orgId: string
  wsId: string
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function AuditLogWorkspace({ token, orgId, wsId }: AuditLogWorkspaceProps) {
  const { t } = useTranslation('audit')
  const [actionFilter, setActionFilter] = useState('')
  const [resultFilter, setResultFilter] = useState<'allow' | 'deny' | ''>('')

  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDone, setIsDone] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchLogs = useCallback(async (cur?: string | null) => {
    if (!token) return
    try {
      const page = await listWorkspaceAuditLog(token, wsId, {
        action: actionFilter || undefined,
        result: (resultFilter || undefined) as 'allow' | 'deny' | undefined,
        cursor: cur ?? undefined,
        numItems: 50,
      })
      if (cur) {
        setLogs((prev) => [...prev, ...page.logs])
      } else {
        setLogs(page.logs)
      }
      setIsDone(page.isDone)
      setCursor(page.cursor)
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [token, orgId, wsId, actionFilter, resultFilter])

  useEffect(() => {
    setIsLoading(true)
    setLogs([])
    fetchLogs(null)
  }, [fetchLogs])

  if (isLoading) {
    return (
      <div data-testid="audit-log-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          data-testid="filter-action"
          type="text"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          placeholder={t('filter_action')}
          className="px-3 py-1.5 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none w-48"
        />
        <select
          data-testid="filter-result"
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value as 'allow' | 'deny' | '')}
          className="px-3 py-1.5 bg-surface-elevated border border-border-default rounded-input text-sm text-text-primary focus:outline-none"
        >
          <option value="">{t('filter_result_all')}</option>
          <option value="allow">{t('filter_result_allow')}</option>
          <option value="deny">{t('filter_result_deny')}</option>
        </select>
      </div>

      {logs.length === 0 ? (
        <div data-testid="audit-log-empty" className="text-center py-12">
          <p className="text-text-muted text-sm">{t('empty')}</p>
        </div>
      ) : (
        <DenseGridContainer>
          <DenseGridHeader
            label={t('header')}
            stats={[{ label: t('label_events'), value: logs.length }]}
          />
          <DenseGridTable>
            <DenseGridThead>
              <DenseGridThNum />
              <DenseGridTh>{t('col_when')}</DenseGridTh>
              <DenseGridTh>{t('col_actor')}</DenseGridTh>
              <DenseGridTh>{t('col_action')}</DenseGridTh>
              <DenseGridTh>{t('col_result')}</DenseGridTh>
            </DenseGridThead>
            <tbody>
              {logs.map((log, i) => (
                <DenseGridRow key={log._id} testId={`log-row-${log._id}`}>
                  <DenseGridRowNum index={i} />
                  <DenseGridCellStack
                    primary={<span className="text-[11px] text-[#6E7681]">{relativeTime(log.timestamp)}</span>}
                  />
                  <DenseGridCellStack primary={log.actorId} />
                  <DenseGridCellStack primary={log.action} />
                  <DenseGridCellStack
                    primary={
                      <span data-testid={`result-badge-${log._id}`}>
                        <DenseGridStatusBadge
                          value={log.result}
                          type={log.result === 'allow' ? 'allow' : 'deny'}
                        />
                      </span>
                    }
                  />
                </DenseGridRow>
              ))}
            </tbody>
          </DenseGridTable>
          <DenseGridFooter
            showing={logs.length}
            onLoadMore={!isDone ? () => { setIsLoadingMore(true); fetchLogs(cursor) } : undefined}
            loadingMore={isLoadingMore}
            isDone={isDone}
          />
        </DenseGridContainer>
      )}
    </div>
  )
}
