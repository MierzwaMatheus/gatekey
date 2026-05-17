import { createRoute } from '@tanstack/react-router'
import { Route as rootRoute } from '../__root'
import { ProtectedRoute } from '../../components/protected-route'
import { useLogout } from '../../lib/use-logout'

function RootDashboard() {
  const { handleLogout, isLoggingOut } = useLogout()

  return (
    <ProtectedRoute requiredRole="root">
      <div data-testid="root-page" className="min-h-screen bg-surface-page p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-medium text-text-primary">Painel Root</h1>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="px-4 py-2 text-sm rounded-button border border-status-deny text-status-deny hover:bg-status-deny hover:text-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
    </ProtectedRoute>
  )
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/root',
  component: RootDashboard,
})
