// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { getUserAccessHistory, type AuditEvent } from '../../lib/org-api'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('pt-BR')
}

interface Props {
  userId: string
  userName: string
  token: string
  onClose: () => void
}

export function UserAccessHistory({ userId, userName, token, onClose }: Props) {
  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [isDone, setIsDone] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [action, setAction] = useState('')

  const load = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      setLoading(true)
      try {
        const params: Parameters<typeof getUserAccessHistory>[2] = {}
        if (fromDate) params.from = new Date(fromDate).getTime()
        if (toDate) params.to = new Date(toDate).getTime()
        if (action) params.action = action
        if (!opts.reset && cursor) params.cursor = cursor

        const page = await getUserAccessHistory(token, userId, params)

        setLogs((prev) => (opts.reset ? page.logs : [...prev, ...page.logs]))
        setIsDone(page.isDone)
        setCursor(page.cursor)
      } finally {
        setLoading(false)
      }
    },
    [token, userId, fromDate, toDate, action, cursor],
  )

  useEffect(() => {
    setCursor(null)
    setLogs([])
    const params: Parameters<typeof getUserAccessHistory>[2] = {}
    if (fromDate) params.from = new Date(fromDate).getTime()
    if (toDate) params.to = new Date(toDate).getTime()
    if (action) params.action = action

    setLoading(true)
    getUserAccessHistory(token, userId, params)
      .then((page) => {
        setLogs(page.logs)
        setIsDone(page.isDone)
        setCursor(page.cursor)
      })
      .finally(() => setLoading(false))
  }, [token, userId, fromDate, toDate, action])

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface-card border border-border-default rounded-card shadow-float w-full max-w-3xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <h2 className="text-text-primary font-semibold">
            Histórico de acesso — {userName}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-3 p-4 border-b border-border-default flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">De</label>
            <input
              type="date"
              data-testid="filter-from-date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-surface-input border border-border-default rounded px-2 py-1 text-sm text-text-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Até</label>
            <input
              type="date"
              data-testid="filter-to-date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-surface-input border border-border-default rounded px-2 py-1 text-sm text-text-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Tipo de ação</label>
            <select
              data-testid="filter-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="bg-surface-input border border-border-default rounded px-2 py-1 text-sm text-text-primary"
            >
              <option value="">Todas</option>
              <option value="permission.check">permission.check</option>
              <option value="auth.login.success">auth.login.success</option>
              <option value="auth.login.failure">auth.login.failure</option>
              <option value="binding.create">binding.create</option>
              <option value="binding.delete">binding.delete</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          {loading && logs.length === 0 && (
            <p className="p-4 text-text-muted text-sm">Carregando...</p>
          )}
          {!loading && logs.length === 0 && (
            <p className="p-4 text-text-muted text-sm">Nenhum evento encontrado.</p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-xs border-b border-border-default">
                <th className="text-left p-3">Data/Hora</th>
                <th className="text-left p-3">Ação</th>
                <th className="text-left p-3">Recurso</th>
                <th className="text-left p-3">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log._id}
                  data-testid="audit-event-row"
                  className="border-b border-border-subtle hover:bg-surface-elevated"
                >
                  <td className="p-3 text-text-secondary font-mono text-xs">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="p-3 text-text-primary font-mono text-xs">{log.action}</td>
                  <td className="p-3 text-text-secondary text-xs">
                    {log.target.type}
                    {log.target.id ? `:${log.target.id}` : ''}
                  </td>
                  <td className="p-3">
                    {log.result === 'allow' ? (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-status-allow/20 text-status-allow">
                        ALLOW
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-status-deny/20 text-status-deny">
                        DENY
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isDone && (
          <div className="p-4 border-t border-border-default">
            <button
              data-testid="load-more-btn"
              onClick={() => load()}
              disabled={loading}
              className="text-sm text-accent-primary hover:underline disabled:opacity-50"
            >
              {loading ? 'Carregando...' : 'Carregar mais'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
