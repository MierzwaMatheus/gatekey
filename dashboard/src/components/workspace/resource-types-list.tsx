import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listResourceTypes,
  checkResourceTypeInheritance,
  updateResourceTypeInheritance,
  type ResourceType,
} from '../../lib/workspace-api'
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

interface InheritanceWarning {
  resourceType: ResourceType
  affectedCount: number
}

export function ResourceTypesList({ token, refreshKey }: ResourceTypesListProps) {
  const { t } = useTranslation('bindings')
  const [resourceTypes, setResourceTypes] = useState<ResourceType[] | null>(null)
  const [warning, setWarning] = useState<InheritanceWarning | null>(null)
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

  async function handleToggleInheritance(rt: ResourceType) {
    const { affectedCount } = await checkResourceTypeInheritance(token, rt.name)
    if (affectedCount > 0) {
      setWarning({ resourceType: rt, affectedCount })
    } else {
      await updateResourceTypeInheritance(token, rt.name, null)
      setResourceTypes((prev) =>
        prev ? prev.map((r) => r._id === rt._id ? { ...r, inheritanceMode: undefined } : r) : prev,
      )
    }
  }

  async function handleConfirmDisable() {
    if (!warning) return
    await updateResourceTypeInheritance(token, warning.resourceType.name, null)
    setResourceTypes((prev) =>
      prev
        ? prev.map((r) => r._id === warning.resourceType._id ? { ...r, inheritanceMode: undefined } : r)
        : prev,
    )
    setWarning(null)
  }

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
        <p className="text-text-muted text-sm">{t('resource_types_empty')}</p>
      </div>
    )
  }

  return (
    <>
      {warning && (
        <div data-testid="dialog-inheritance-warning" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full space-y-4">
            <p className="text-sm text-gray-800">
              {warning.affectedCount} usuário(s) perderão acesso a itens herdados do container.
              Bindings diretos não são afetados. Deseja continuar?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                data-testid="btn-cancel-inheritance"
                onClick={() => setWarning(null)}
                className="px-3 py-1.5 text-sm rounded border border-gray-300 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                data-testid="btn-confirm-inheritance"
                onClick={handleConfirmDisable}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
      <DenseGridContainer testId="resource-types-list">
        <DenseGridHeader label={t('resource_types_header')} stats={[{ label: 'total', value: resourceTypes.length }]} />
        <DenseGridTable>
          <DenseGridThead>
            <DenseGridThNum />
            <DenseGridTh>{t('resource_types_col_name')}</DenseGridTh>
            <DenseGridTh>{t('resource_types_col_inherits')}</DenseGridTh>
            <DenseGridTh>{t('resource_types_col_mode')}</DenseGridTh>
            <DenseGridTh>Ações</DenseGridTh>
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
                <DenseGridCell>
                  {rt.inheritanceMode && (
                    <button
                      data-testid={`btn-toggle-inheritance-${rt._id}`}
                      onClick={() => handleToggleInheritance(rt)}
                      className="text-[11px] text-red-600 hover:underline"
                    >
                      Desativar herança
                    </button>
                  )}
                </DenseGridCell>
              </DenseGridRow>
            ))}
          </tbody>
        </DenseGridTable>
        <DenseGridFooter showing={resourceTypes.length} />
      </DenseGridContainer>
    </>
  )
}
