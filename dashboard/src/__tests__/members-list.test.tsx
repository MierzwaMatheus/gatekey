// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MembersList } from '../components/workspace/members-list'
import * as workspaceApi from '../lib/workspace-api'

vi.mock('../lib/workspace-api')

const mockMembers = [
  {
    userId: 'user1',
    userName: 'Alice',
    userEmail: 'alice@acme.com',
    roleName: 'admin',
    addedAt: Date.now() - 1000 * 60 * 60 * 24,
  },
  {
    userId: 'user2',
    userName: 'Bob',
    userEmail: 'bob@acme.com',
    roleName: 'viewer',
    addedAt: Date.now() - 1000 * 60 * 30,
  },
]

describe('MembersList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(workspaceApi.listMembers).mockReturnValue(new Promise(() => {}))
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    expect(screen.getByTestId('members-loading')).toBeDefined()
  })

  it('renders member rows after loading', async () => {
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    await waitFor(() => expect(screen.getByText('Alice')).toBeDefined())
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('shows member email', async () => {
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    await waitFor(() => expect(screen.getByText('alice@acme.com')).toBeDefined())
  })

  it('shows role name for each member', async () => {
    vi.mocked(workspaceApi.listMembers).mockResolvedValue(mockMembers)
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    await waitFor(() => screen.getByText('admin'))
    expect(screen.getByText('viewer')).toBeDefined()
  })

  it('renders empty state when no members', async () => {
    vi.mocked(workspaceApi.listMembers).mockResolvedValue([])
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('members-empty')).toBeDefined())
  })

  it('renders error state when fetch fails', async () => {
    vi.mocked(workspaceApi.listMembers).mockRejectedValue(new Error('network error'))
    render(<MembersList token="tok" wsId="ws1" onAddMember={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('members-error')).toBeDefined())
  })

  it('calls listMembers with correct wsId and token', async () => {
    vi.mocked(workspaceApi.listMembers).mockResolvedValue([])
    render(<MembersList token="my-token" wsId="ws-abc" onAddMember={() => {}} />)
    await waitFor(() => screen.getByTestId('members-empty'))
    expect(workspaceApi.listMembers).toHaveBeenCalledWith('my-token', 'ws-abc')
  })
})
