import { useEffect, useState, useRef } from 'react'
import { Zap, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  listCapabilities,
  createCapability,
  deleteCapability,
  getCapabilityUsage,
  type Capability,
  type CapabilityUsageRole,
} from '../../lib/org-api'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(3, 'Use formato tipo:ação (ex: document:read)').regex(/^[a-z]+:[a-z]+$/, 'Use formato tipo:ação'),
  description: z.string().min(3, 'Descrição obrigatória'),
})

type FormData = z.infer<typeof schema>

function CreateCapabilityForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
  const { t } = useTranslation('common')
  const [apiError, setApiError] = useState<string | null>(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: FormData) {
    setApiError(null)
    try {
      await createCapability(token, data)
      reset()
      onSuccess()
    } catch (e) {
      const msg = (e as Error).message ?? ''
      setApiError(msg === 'QuotaExceeded' ? t('caps_org.quota_exceeded') : t('caps_org.error_create'))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" data-testid="create-capability-form">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <input
            {...register('name')}
            placeholder="tipo:ação (ex: document:read)"
            className="w-full px-3 py-2 text-sm font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
          {errors.name && <p className="text-[12px] text-status-deny mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <input
            {...register('description')}
            placeholder="Descrição"
            className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
          />
          {errors.description && <p className="text-[12px] text-status-deny mt-1">{errors.description.message}</p>}
        </div>
      </div>
      {apiError && <p className="text-[12px] text-status-deny">{apiError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center gap-1.5 px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        <Plus size={14} />
        {isSubmitting ? t('caps_org.creating') : t('caps_org.create')}
      </button>
    </form>
  )
}

interface ConfirmDeleteDialogProps {
  capName: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDeleteDialog({ capName, onConfirm, onCancel }: ConfirmDeleteDialogProps) {
  return (
    <div data-testid="confirm-delete-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface-elevated border border-border-default rounded-panel p-6 w-full max-w-sm space-y-4">
        <p className="text-sm text-text-primary">
          Remover a capability <span className="font-mono text-accent-primary">{capName}</span>? Esta ação não pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded-button hover:bg-surface-elevated"
          >
            Cancelar
          </button>
          <button
            data-testid="confirm-delete-btn"
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-status-deny text-white rounded-button hover:opacity-90"
          >
            Remover
          </button>
        </div>
      </div>
    </div>
  )
}

interface CapabilitiesListOrgProps {
  token: string
  orgId?: string
}

export function CapabilitiesListOrg({ token, orgId }: CapabilitiesListOrgProps) {
  const { t } = useTranslation('common')
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null)
  const [usageMap, setUsageMap] = useState<Record<string, CapabilityUsageRole[]>>({})
  const [error, setError] = useState(false)
  const [capKey, setCapKey] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Capability | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function load() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(false)
    listCapabilities(token)
      .then(async ({ capabilities: caps }) => {
        if (ac.signal.aborted) return
        setCapabilities(caps)

        const custom = caps.filter((c) => !c.isBase)
        const usages = await Promise.all(
          custom.map((c) => getCapabilityUsage(token, c._id).then((u) => [c._id, u.roles] as const)),
        )
        if (!ac.signal.aborted) {
          const map: Record<string, CapabilityUsageRole[]> = {}
          for (const [id, roles] of usages) map[id] = roles
          setUsageMap(map)
        }
      })
      .catch(() => { if (!ac.signal.aborted) setError(true) })
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [token, capKey])

  async function handleDelete(cap: Capability) {
    try {
      await deleteCapability(token, cap._id)
      setCapKey((k) => k + 1)
    } catch {}
    setConfirmDelete(null)
  }

  if (error) return <div className="py-8 text-center text-sm text-status-deny">{t('caps_org.error')}</div>

  if (capabilities === null) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-surface-elevated animate-pulse rounded-[6px]" />)}</div>
  }

  const base = capabilities.filter((c) => c.isBase)
  const custom = capabilities.filter((c) => !c.isBase)

  return (
    <div className="space-y-6">
      {confirmDelete && (
        <ConfirmDeleteDialog
          capName={confirmDelete.name}
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Base capabilities */}
      <div>
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">
          {t('caps_org.base_catalog')}
        </p>
        <div className="flex flex-wrap gap-2">
          {base.map((cap) => (
            <div
              key={cap._id}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-surface-elevated border border-border-default rounded-badge"
            >
              <Zap size={11} className="text-text-secondary" />
              <span className="text-[11px] font-mono text-text-secondary">{cap.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom capabilities */}
      <div>
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">
          {t('caps_org.custom_catalog')}
        </p>
        {custom.length === 0 ? (
          <p className="text-[13px] text-text-secondary mb-4">{t('caps_org.none_custom')}</p>
        ) : (
          <div className="space-y-2 mb-4">
            {custom.map((cap) => {
              const usedBy = usageMap[cap._id] ?? []
              const inUse = usedBy.length > 0
              const tooltipText = inUse
                ? `Usada pelos roles: ${usedBy.map((r) => r.roleName).join(', ')}`
                : 'Remover capability'

              return (
                <div
                  key={cap._id}
                  className="flex items-center justify-between px-3 py-2 bg-accent-subtle border border-border-accent rounded-badge"
                >
                  <div className="flex items-center gap-2">
                    <Zap size={11} className="text-accent-primary" />
                    <span className="text-[11px] font-mono text-accent-primary">{cap.name}</span>
                    {inUse && (
                      <span
                        data-testid={`usage-count-${cap._id}`}
                        className="text-[10px] text-text-muted ml-1 flex items-center gap-1 flex-wrap"
                      >
                        Usada por {usedBy.length} role{usedBy.length !== 1 ? 's' : ''}:
                        {usedBy.map((r) =>
                          r.workspaceId && orgId ? (
                            <a
                              key={r.roleId}
                              data-testid={`role-link-${r.roleId}`}
                              href={`/org/${orgId}/workspace/${r.workspaceId}?section=roles`}
                              className="underline hover:text-accent-primary"
                            >
                              {r.roleName}
                            </a>
                          ) : (
                            <span key={r.roleId} data-testid={`role-name-${r.roleId}`}>
                              {r.roleName}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </div>
                  <button
                    data-testid={`remove-cap-${cap._id}`}
                    disabled={inUse}
                    title={tooltipText}
                    onClick={() => !inUse && setConfirmDelete(cap)}
                    className="p-1 rounded text-text-muted hover:text-status-deny disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div className="border-t border-border-default pt-5">
          <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">{t('caps_org.new_cap')}</p>
          <CreateCapabilityForm token={token} onSuccess={() => setCapKey((k) => k + 1)} />
        </div>
      </div>
    </div>
  )
}
