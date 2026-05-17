import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

interface Props {
  convexUrl: string
  children: ReactNode
}

export function ConvexProviderWithAuth({ convexUrl, children }: Props) {
  const client = new ConvexReactClient(convexUrl)
  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
