import { createRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Route as rootRoute } from './__root'
import { loginSchema, type LoginFormData } from '../lib/schemas'
import { authService, AuthError, parseJwtPayload } from '../lib/auth-service'
import { useAuth } from '../lib/auth-context'
import { useNavigate } from '@tanstack/react-router'

export function LoginPage() {
  const { setAuth } = useAuth()
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true)
    setApiError(null)

    try {
      const result = await authService.login(data.email, data.password)
      const payload = parseJwtPayload(result.accessToken)
      const role = payload.orgId ? 'org_admin' : 'root'
      setAuth({
        token: result.accessToken,
        role,
        orgId: result.orgId,
      })
      if (result.mustChangePassword) {
        navigate({ to: '/change-password' })
      } else {
        navigate({ to: '/root' })
      }
    } catch (err) {
      if (err instanceof AuthError) {
        if (err.reason === 'invalid_credentials') {
          setApiError('Email ou senha incorretos.')
        } else if (err.reason === 'account_locked') {
          setApiError('Conta bloqueada temporariamente. Tente novamente mais tarde.')
        } else {
          setApiError('Erro ao fazer login. Tente novamente.')
        }
      } else {
        setApiError('Erro inesperado. Tente novamente.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-page flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-card rounded-card shadow-card p-8 border border-border-default">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium text-accent-primary font-mono tracking-tight">
            GateKey
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Faça login para continuar
          </p>
        </div>

        {apiError && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-badge border border-status-deny text-status-deny text-sm font-mono"
          >
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="seu@email.com"
              className="w-full bg-surface-elevated border border-border-default text-text-primary placeholder:text-text-muted rounded-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-border-accent transition-colors"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-status-deny" role="alert">
                Email inválido
              </p>
            )}
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary mb-1"
            >
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full bg-surface-elevated border border-border-default text-text-primary placeholder:text-text-muted rounded-input px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-border-accent transition-colors"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-status-deny" role="alert">
                Senha obrigatória
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent-primary text-black font-medium rounded-button py-2 text-sm hover:bg-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})
