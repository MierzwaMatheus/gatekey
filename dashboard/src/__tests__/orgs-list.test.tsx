import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OrgsList } from '../components/root/orgs-list'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockOrgs = [
  {
    _id: 'org1',
    name: 'Acme Corp',
    status: 'active' as const,
    usersCount: 12,
    workspacesCount: 3,
    updatedAt: Date.now() - 1000 * 60 * 5,
  },
  {
    _id: 'org2',
    name: 'Globex',
    status: 'suspended' as const,
    usersCount: 5,
    workspacesCount: 1,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
  {
    _id: 'org3',
    name: 'Initech',
    status: 'deleted' as const,
    usersCount: 0,
    workspacesCount: 0,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
]

describe('OrgsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(rootApi.listOrgs).mockReturnValue(new Promise(() => {}))
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    expect(screen.getByTestId('orgs-loading')).toBeDefined()
  })

  it('renders org rows after loading', async () => {
    vi.mocked(rootApi.listOrgs).mockResolvedValue(mockOrgs)
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeDefined())
    expect(screen.getByText('Globex')).toBeDefined()
    expect(screen.getByText('Initech')).toBeDefined()
  })

  it('renders status pills with correct test ids', async () => {
    vi.mocked(rootApi.listOrgs).mockResolvedValue(mockOrgs)
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    await waitFor(() => screen.getByTestId('status-org1'))
    expect(screen.getByTestId('status-org1').textContent).toContain('active')
    expect(screen.getByTestId('status-org2').textContent).toContain('suspended')
    expect(screen.getByTestId('status-org3').textContent).toContain('deleted')
  })

  it('renders empty state when no orgs', async () => {
    vi.mocked(rootApi.listOrgs).mockResolvedValue([])
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('orgs-empty')).toBeDefined())
  })

  it('renders user and workspace counts', async () => {
    vi.mocked(rootApi.listOrgs).mockResolvedValue(mockOrgs)
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    await waitFor(() => screen.getByText('Acme Corp'))
    expect(screen.getByTestId('users-count-org1').textContent).toBe('12')
    expect(screen.getByTestId('workspaces-count-org1').textContent).toBe('3')
  })

  it('renders error state on fetch failure', async () => {
    vi.mocked(rootApi.listOrgs).mockRejectedValue(new Error('network error'))
    render(<OrgsList token="tok" onSelectOrg={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('orgs-error')).toBeDefined())
  })
})
