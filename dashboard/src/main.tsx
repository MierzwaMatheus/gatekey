import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { ConvexProviderWithAuth } from './lib/convex-provider'
import { routeTree } from './routeTree.gen'
import './globals.css'

const router = createRouter({ routeTree })

const convexUrl = import.meta.env.VITE_CONVEX_URL as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConvexProviderWithAuth convexUrl={convexUrl}>
      <RouterProvider router={router} />
    </ConvexProviderWithAuth>
  </StrictMode>,
)
