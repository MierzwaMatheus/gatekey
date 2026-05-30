// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { EffectiveAccessView } from '../components/workspace/effective-access-view'
import * as workspaceApi from '../lib/workspace-api'

vi.mock('../lib/workspace-api')

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockMembers = [
  { userId: 'user1', userName: 'Alice', userEmail: 'alice@acme.com', roleName: 'editor', addedAt: 0 },
  { userId: 'user2', userName: 'Bob',   userEmail: 'bob@acme.com',   roleName: 'viewer', addedAt: 0 },
]

const mockAccessWithWorkspace = {
  workspaceAccess: { role: 'editor', source: 'workspace-binding' as const },
  resourceAccess: [],
}

const mockAccessNullWorkspace = {
  workspaceAccess: null,
  resourceAccess: [],
}

const mockAccessWithResources = {
  workspaceAccess: { role: 'editor', source: 'workspace-binding' as const },
  resourceAccess: [
    { resourceType: 'document', resourceId: 'doc-1', effectiveRole: 'editor', source: 'direct-binding' },
    { resourceType: 'document', resourceId: 'doc-2', effectiveRole: null,     source: 'explicit-deny', deniedBy: 'admin@acme.com' },
    { resourceType: 'folder',   resourceId: 'fold-1', effectiveRole: 'viewer', source: 'inherited-from-folder:folder-abc' },
  ],
}

// ── Ciclo 1: API function ────────────────────────────────────────────────────

describe('getEffectiveAccess API', () => {
  it('calls GET /v1/users/{userId}/effective-access?workspaceId={wsId}', async () => {
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessWithWorkspace)
    await workspaceApi.getEffectiveAccess('tok', 'user1', 'ws1')
    expect(workspaceApi.getEffectiveAccess).toHaveBeenCalledWith('tok', 'user1', 'ws1')
  })
})

// ── Ciclo 2: workspace access section ───────────────────────────────────────

describe('EffectiveAccessView — workspace access section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
  })

  it('renders loading skeleton while fetching members', () => {
    vi.mocked(workspaceApi.listMembers).mockReturnValue(new Promise(() => {}))
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    expect(screen.getByTestId('effective-access-loading')).toBeDefined()
  })

  it('renders workspace-access-section when workspaceAccess is not null', async () => {
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessWithWorkspace)
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    await waitFor(() => expect(screen.getByTestId('workspace-access-section')).toBeDefined())
    expect(screen.getByText('editor')).toBeDefined()
  })
})

// ── Ciclo 3: null workspace access ──────────────────────────────────────────

describe('EffectiveAccessView — null workspace access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
  })

  it('renders workspace-access-empty when workspaceAccess is null', async () => {
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessNullWorkspace)
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    await waitFor(() => expect(screen.getByTestId('workspace-access-empty')).toBeDefined())
  })
})

// ── Ciclo 4: resource table with deny badge ──────────────────────────────────

describe('EffectiveAccessView — resource access table', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessWithResources)
  })

  async function renderAndSelect() {
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    await waitFor(() => screen.getByTestId('resource-table'))
  }

  it('renders resource-table with rows after selecting user', async () => {
    await renderAndSelect()
    expect(screen.getByTestId('resource-row-doc-1')).toBeDefined()
    expect(screen.getByTestId('resource-row-doc-2')).toBeDefined()
    expect(screen.getByTestId('resource-row-fold-1')).toBeDefined()
  })

  it('renders access-denied-badge for effectiveRole null', async () => {
    await renderAndSelect()
    expect(screen.getByTestId('access-denied-badge')).toBeDefined()
  })

  // ── Ciclo 5: inherited badge ──────────────────────────────────────────────

  it('renders inherited-badge for source starting with inherited-from-', async () => {
    await renderAndSelect()
    expect(screen.getByTestId('inherited-badge')).toBeDefined()
    expect(screen.getByText(/folder-abc/)).toBeDefined()
  })
})

// ── Ciclo 6: user selector shows workspace members ───────────────────────────

describe('EffectiveAccessView — user selector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
  })

  it('populates user selector with workspace members', async () => {
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    expect(screen.getByText('Alice')).toBeDefined()
    expect(screen.getByText('Bob')).toBeDefined()
  })
})

// ── Ciclo 7: refresh + resourceType filter ───────────────────────────────────

describe('EffectiveAccessView — refresh and filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessWithResources)
  })

  async function renderAndSelect() {
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    await waitFor(() => screen.getByTestId('resource-table'))
  }

  it('btn-refresh triggers another getEffectiveAccess call', async () => {
    await renderAndSelect()
    fireEvent.click(screen.getByTestId('btn-refresh'))
    await waitFor(() => expect(workspaceApi.getEffectiveAccess).toHaveBeenCalledTimes(2))
  })

  it('select-resource-type filters the resource table', async () => {
    await renderAndSelect()
    fireEvent.change(screen.getByTestId('select-resource-type'), { target: { value: 'folder' } })
    await waitFor(() => {
      expect(screen.queryByTestId('resource-row-doc-1')).toBeNull()
      expect(screen.getByTestId('resource-row-fold-1')).toBeDefined()
    })
  })
})

// ── Ciclo 9: integration test ────────────────────────────────────────────────

describe('EffectiveAccessView — integration: allow + deny + inherited', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    vi.mocked(workspaceApi.getEffectiveAccess).mockResolvedValue(mockAccessWithResources)
  })

  it('renders 3 resource rows with correct styles for allow, deny and inherited', async () => {
    render(<EffectiveAccessView token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    await waitFor(() => screen.getByTestId('resource-table'))

    // allow direto
    expect(screen.getByTestId('resource-row-doc-1')).toBeDefined()
    // deny
    expect(screen.getByTestId('access-denied-badge')).toBeDefined()
    // herdado
    expect(screen.getByTestId('inherited-badge')).toBeDefined()
  })
})
