// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConvexProviderWithAuth } from '../lib/convex-provider'

vi.mock('convex/react', () => ({
  ConvexProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="convex-provider">{children}</div>,
  ConvexReactClient: class MockClient { constructor(_url: string) {} },
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
}))

describe('ConvexProvider wrapper', () => {
  it('renders children inside provider', () => {
    render(
      <ConvexProviderWithAuth convexUrl="https://test.convex.cloud">
        <div data-testid="child">content</div>
      </ConvexProviderWithAuth>
    )
    expect(screen.getByTestId('child')).toBeDefined()
  })
})
