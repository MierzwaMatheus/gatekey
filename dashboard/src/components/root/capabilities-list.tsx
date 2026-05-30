import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { listCapabilities, createCapability, type Capability } from '../../lib/root-api'

/* Empty state — octógono + chave pontilhada ausente */
function EmptyState() {
  const { t } = useTranslation('common')
  return (
    <div data-testid="capabilities-empty" className="flex flex-col items-center justify-center py-16 gap-4">
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
        <polygon
          points="60,10 100,30 110,70 90,110 30,110 10,70 20,30 60,10"
          stroke="#30363D"
          strokeWidth="1.5"
          fill="none"
        />
        <rect
          x="40" y="52" width="40" height="16" rx="8"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
        <rect
          x="68" y="57" width="10" height="8" rx="2"
          stroke="#8B949E"
          strokeWidth="1"
          strokeDasharray="4 2"
          fill="none"
        />
      </svg>
      <p className="text-[15px] text-text-primary">{t('caps.empty_title')}</p>
      <p className="text-[13px] text-text-secondary">{t('caps.empty_subtitle')}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div data-testid="capabilities-loading" className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-6 w-28 bg-surface-elevated rounded-badge animate-pulse" />
      ))}
    </div>
  )
}

const addCapSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').regex(/^[a-z0-9_:]+$/, 'Use apenas letras minúsculas, números, : e _'),
  description: z.string().min(1, 'Descrição é obrigatória'),
})
type AddCapData = z.infer<typeof addCapSchema>

interface CapabilitiesListProps {
  token: string
}

export function CapabilitiesList({ token }: CapabilitiesListProps) {
  const { t } = useTranslation('common')
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null)

  const load = useCallback(() => {
    setCapabilities(null)
    listCapabilities(token)
      .then(({ capabilities: caps }) => setCapabilities(caps))
      .catch(() => setCapabilities([]))
  }, [token])

  useEffect(() => { load() }, [load])

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<AddCapData>({ resolver: zodResolver(addCapSchema) })

  async function onSubmit(data: AddCapData) {
    await createCapability(token, { name: data.name, description: data.description })
    reset()
    load()
  }

  return (
    <div className="space-y-6">
      {/* Catálogo existente */}
      <div className="space-y-3">
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
          {t('caps.catalog_base')}
        </p>
        {capabilities === null ? (
          <LoadingSkeleton />
        ) : capabilities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-wrap gap-2">
            {capabilities.map((cap) => (
              <div
                key={cap._id}
                data-testid={`cap-badge-${cap._id}`}
                title={cap.description}
                className="inline-flex items-center px-2.5 py-1 rounded-badge bg-accent-subtle text-accent-primary font-mono text-[11px] border border-accent-primary/20 cursor-default"
              >
                {cap.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulário de adição */}
      <div className="border-t border-border-default pt-5 space-y-3">
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide">
          {t('caps.add_to_catalog')}
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <input
                data-testid="input-cap-name"
                type="text"
                placeholder="ex: document:read"
                {...register('name')}
                className="w-full px-3 py-1.5 text-[12px] font-mono bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
              />
              {errors.name && (
                <p className="text-[10px] text-status-deny">{errors.name.message}</p>
              )}
            </div>
            <div className="flex-1 space-y-1">
              <input
                data-testid="input-cap-description"
                type="text"
                placeholder="Descrição da capability"
                {...register('description')}
                className="w-full px-3 py-1.5 text-[12px] bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
              />
              {errors.description && (
                <p className="text-[10px] text-status-deny">{errors.description.message}</p>
              )}
            </div>
            <button
              data-testid="btn-add-capability"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-[12px] font-medium bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex-shrink-0"
            >
              {isSubmitting ? t('caps.adding') : t('caps.add_btn')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
