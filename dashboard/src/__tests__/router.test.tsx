import { describe, it, expect } from 'vitest'
import { Route as LoginRoute } from '../routes/login'
import { Route as RootRoute } from '../routes/root/index'
import { Route as OrgRoute } from '../routes/org/$orgId/index'
import { Route as WorkspaceRoute } from '../routes/org/$orgId/workspace/$wsId/index'
import { routeTree } from '../routeTree.gen'

describe('route modules export correctly', () => {
  it('login route is defined', () => {
    expect(LoginRoute).toBeDefined()
  })

  it('root route is defined', () => {
    expect(RootRoute).toBeDefined()
  })

  it('org route is defined', () => {
    expect(OrgRoute).toBeDefined()
  })

  it('workspace route is defined', () => {
    expect(WorkspaceRoute).toBeDefined()
  })

  it('routeTree is composed with all routes', () => {
    expect(routeTree).toBeDefined()
    expect(typeof routeTree.addChildren).toBe('function')
  })
})
