import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ConvexProviderWithAuth } from './lib/convex-provider'
import { AuthProvider } from './lib/auth-context'
import { routeTree } from './routeTree.gen'
import './globals.css'

const router = createRouter({ routeTree })

const convexUrl = import.meta.env.VITE_CONVEX_URL as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProviderWithAuth convexUrl={convexUrl}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ConvexProviderWithAuth>
  </StrictMode>,
)
