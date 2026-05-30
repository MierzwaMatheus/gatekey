import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createWorkspace } from '../../lib/org-api'

const schema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
})

type FormData = z.infer<typeof schema>

interface CreateWorkspaceFormProps {
  token: string
  onSuccess: () => void
}

export function CreateWorkspaceForm({ token, onSuccess }: CreateWorkspaceFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setApiError(null)
    try {
      await createWorkspace(token, data)
      reset()
      onSuccess()
    } catch (e) {
      const msg = (e as Error).message ?? ''
      if (msg === 'QuotaExceeded') {
        setApiError('Cota de workspaces da organização atingida.')
      } else {
        setApiError('Erro ao criar workspace. Tente novamente.')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex gap-2" data-testid="create-workspace-form">
      <div className="flex-1">
        <input
          {...register('name')}
          type="text"
          placeholder="Nome do workspace"
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
        />
        {errors.name && (
          <p className="text-[12px] text-status-deny mt-1">{errors.name.message}</p>
        )}
        {apiError && (
          <p className="text-[12px] text-status-deny mt-1">{apiError}</p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
      >
        {isSubmitting ? 'Criando…' : 'Criar'}
      </button>
    </form>
  )
}
