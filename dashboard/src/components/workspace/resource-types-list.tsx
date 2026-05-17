import { useState, useEffect, useRef } from 'react'
import { listResourceTypes, type ResourceType } from '../../lib/workspace-api'

interface ResourceTypesListProps {
  token: string
  refreshKey?: number
}

export function ResourceTypesList({ token, refreshKey }: ResourceTypesListProps) {
  const [resourceTypes, setResourceTypes] = useState<ResourceType[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setResourceTypes(null)

    listResourceTypes(token)
      .then((data) => { if (!ac.signal.aborted) setResourceTypes(data) })
      .catch(() => { if (!ac.signal.aborted) setResourceTypes([]) })

    return () => ac.abort()
  }, [token, refreshKey])

  if (resourceTypes === null) {
    return (
      <div data-testid="resource-types-loading" className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 bg-surface-elevated animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (resourceTypes.length === 0) {
    return (
      <div data-testid="resource-types-empty" className="text-center py-12">
        <p className="text-text-muted text-sm">Nenhum resource type registrado.</p>
      </div>
    )
  }

  return (
    <div data-testid="resource-types-list">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Nome</th>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Herda De</th>
            <th className="text-left py-2 px-3 text-[11px] font-medium text-text-secondary uppercase tracking-wide">Modo de Herança</th>
          </tr>
        </thead>
        <tbody>
          {resourceTypes.map((rt) => (
            <tr
              key={rt._id}
              data-testid={`resource-type-row-${rt._id}`}
              className="border-b border-border-default hover:bg-surface-hover"
            >
              <td className="py-2.5 px-3 text-text-primary font-mono">{rt.name}</td>
              <td className="py-2.5 px-3 text-text-secondary text-xs font-mono">
                {rt.inheritsFrom ?? '—'}
              </td>
              <td className="py-2.5 px-3">
                {rt.inheritanceMode ? (
                  <span className="px-2 py-0.5 rounded-pill bg-surface-elevated text-text-secondary text-xs">
                    {rt.inheritanceMode}
                  </span>
                ) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
