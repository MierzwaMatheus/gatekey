import { useState, useEffect, useRef } from 'react'
import { listResourceTypes, type ResourceType } from '../../lib/workspace-api'
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
    <DenseGridContainer testId="resource-types-list">
      <DenseGridHeader label="Resource Types" stats={[{ label: 'total', value: resourceTypes.length }]} />
      <DenseGridTable>
        <DenseGridThead>
          <DenseGridThNum />
          <DenseGridTh>Nome</DenseGridTh>
          <DenseGridTh>Herda De</DenseGridTh>
          <DenseGridTh>Modo de Herança</DenseGridTh>
        </DenseGridThead>
        <tbody>
          {resourceTypes.map((rt, i) => (
            <DenseGridRow key={rt._id} testId={`resource-type-row-${rt._id}`}>
              <DenseGridRowNum index={i} />
              <DenseGridCellStack primary={rt.name} />
              <DenseGridCell>
                <span className="text-[11px] text-[#6E7681]">{rt.inheritsFrom ?? '—'}</span>
              </DenseGridCell>
              <DenseGridCell>
                {rt.inheritanceMode
                  ? <DenseGridStatusBadge value={rt.inheritanceMode} type="neutral" />
                  : <span className="text-[11px] text-[#484F58]">—</span>}
              </DenseGridCell>
            </DenseGridRow>
          ))}
        </tbody>
      </DenseGridTable>
      <DenseGridFooter showing={resourceTypes.length} />
    </DenseGridContainer>
  )
}
