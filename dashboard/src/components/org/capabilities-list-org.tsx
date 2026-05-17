import { useEffect, useState, useRef } from 'react'
import { Zap, Plus } from 'lucide-react'
import { listCapabilities, createCapability, type Capability } from '../../lib/org-api'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  name: z.string().min(3, 'Use formato tipo:ação (ex: document:read)').regex(/^[a-z]+:[a-z]+$/, 'Use formato tipo:ação'),
  description: z.string().min(3, 'Descrição obrigatória'),
})

type FormData = z.infer<typeof schema>

function CreateCapabilityForm({ token, onSuccess }: { token: string; onSuccess: () => void }) {
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
      setApiError(msg === 'QuotaExceeded' ? 'Cota de capabilities atingida.' : 'Erro ao criar capability.')
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
        {isSubmitting ? 'Criando…' : 'Criar capability'}
      </button>
    </form>
  )
}

interface CapabilitiesListOrgProps {
  token: string
}

export function CapabilitiesListOrg({ token }: CapabilitiesListOrgProps) {
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null)
  const [error, setError] = useState(false)
  const [capKey, setCapKey] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  function load() {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(false)
    listCapabilities(token)
      .then(({ capabilities: caps }) => { if (!ac.signal.aborted) setCapabilities(caps) })
      .catch(() => { if (!ac.signal.aborted) setError(true) })
  }

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [token, capKey])

  if (error) return <div className="py-8 text-center text-sm text-status-deny">Erro ao carregar capabilities.</div>

  if (capabilities === null) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-surface-elevated animate-pulse rounded-[6px]" />)}</div>
  }

  const base = capabilities.filter((c) => c.isBase)
  const custom = capabilities.filter((c) => !c.isBase)

  return (
    <div className="space-y-6">
      {/* Base capabilities */}
      <div>
        <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">
          Catálogo Base
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
          Customizadas da Org
        </p>
        {custom.length === 0 ? (
          <p className="text-[13px] text-text-secondary mb-4">Nenhuma capability customizada ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {custom.map((cap) => (
              <div
                key={cap._id}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-subtle border border-border-accent rounded-badge"
              >
                <Zap size={11} className="text-accent-primary" />
                <span className="text-[11px] font-mono text-accent-primary">{cap.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-border-default pt-5">
          <p className="text-[12px] font-medium text-text-secondary uppercase tracking-wide mb-3">Nova Capability</p>
          <CreateCapabilityForm token={token} onSuccess={() => setCapKey((k) => k + 1)} />
        </div>
      </div>
    </div>
  )
}
