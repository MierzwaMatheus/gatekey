import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createOrg } from '../../lib/root-api'

const createOrgSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  adminEmail: z.string().email('Email inválido'),
})

type CreateOrgData = z.infer<typeof createOrgSchema>

interface CreateOrgFormProps {
  token: string
  onSuccess: (orgId: string) => void
}

export function CreateOrgForm({ token, onSuccess }: CreateOrgFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrgData>({ resolver: zodResolver(createOrgSchema) })

  async function onSubmit(data: CreateOrgData) {
    setApiError(null)
    try {
      const result = await createOrg(token, { name: data.name, adminEmail: data.adminEmail })
      reset()
      onSuccess(result.orgId)
    } catch (err) {
      setApiError((err as Error).message ?? 'Erro ao criar organização')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="org-name" className="block text-[12px] font-medium text-text-secondary">
          Nome da Organização
        </label>
        <input
          id="org-name"
          data-testid="input-org-name"
          type="text"
          placeholder="Ex: Acme Corp"
          {...register('name')}
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
        {errors.name && (
          <p data-testid="error-org-name" className="text-[11px] text-status-deny">
            {errors.name.message}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="admin-email" className="block text-[12px] font-medium text-text-secondary">
          Email do Org Admin
        </label>
        <input
          id="admin-email"
          data-testid="input-admin-email"
          type="email"
          placeholder="admin@empresa.com"
          {...register('adminEmail')}
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent transition-colors"
        />
        {errors.adminEmail && (
          <p data-testid="error-admin-email" className="text-[11px] text-status-deny">
            {errors.adminEmail.message}
          </p>
        )}
      </div>

      {apiError && (
        <p data-testid="form-api-error" className="text-[12px] text-status-deny">
          {apiError}
        </p>
      )}

      <button
        data-testid="btn-create-org"
        type="submit"
        disabled={isSubmitting}
        className="w-full py-2 px-4 text-sm font-medium bg-accent-primary text-black rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {isSubmitting ? 'Criando…' : 'Criar Organização'}
      </button>
    </form>
  )
}
