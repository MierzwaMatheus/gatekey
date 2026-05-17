import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { createUser } from '../../lib/org-api'

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  role: z.enum(['admin', 'editor', 'viewer'], { required_error: 'Selecione um role' }),
})

type FormData = z.infer<typeof schema>

interface CreateUserFormProps {
  token: string
  onSuccess: () => void
}

export function CreateUserForm({ token, onSuccess }: CreateUserFormProps) {
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'viewer' },
  })

  async function onSubmit(data: FormData) {
    setApiError(null)
    try {
      await createUser(token, data)
      reset()
      onSuccess()
    } catch (e) {
      const msg = (e as Error).message ?? 'Erro desconhecido'
      if (msg === 'QuotaExceeded') {
        setApiError('Cota de usuários da organização atingida.')
      } else {
        setApiError('Erro ao criar usuário. Tente novamente.')
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" data-testid="create-user-form">
      <div>
        <input
          {...register('email')}
          type="email"
          placeholder="email@exemplo.com"
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
        />
        {errors.email && (
          <p className="text-[12px] text-status-deny mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <input
          {...register('password')}
          type="password"
          placeholder="Senha inicial (mín. 8 caracteres)"
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent"
        />
        {errors.password && (
          <p className="text-[12px] text-status-deny mt-1">{errors.password.message}</p>
        )}
      </div>

      <div>
        <select
          {...register('role')}
          className="w-full px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-input text-text-primary focus:outline-none focus:border-border-accent cursor-pointer"
        >
          <option value="admin">admin</option>
          <option value="editor">editor</option>
          <option value="viewer">viewer</option>
        </select>
        {errors.role && (
          <p className="text-[12px] text-status-deny mt-1">{errors.role.message}</p>
        )}
      </div>

      {apiError && (
        <p className="text-[12px] text-status-deny">{apiError}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full px-4 py-2 bg-accent-primary text-black text-sm font-medium rounded-button hover:bg-accent-hover transition-colors disabled:opacity-60 cursor-pointer"
      >
        {isSubmitting ? 'Criando…' : 'Criar usuário'}
      </button>
    </form>
  )
}
