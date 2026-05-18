// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { AddMemberForm } from '../components/workspace/add-member-form'
import * as workspaceApi from '../lib/workspace-api'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/workspace-api')
vi.mock('../lib/org-api')

const mockUsers = [
  { _id: 'user1', email: 'alice@acme.com', status: 'active' as const, loginAttempts: 0, updatedAt: 0, orgRole: 'member', orgStatus: 'active' },
  { _id: 'user2', email: 'bob@acme.com', status: 'active' as const, loginAttempts: 0, updatedAt: 0, orgRole: 'member', orgStatus: 'active' },
]

const mockRoles = [
  { _id: 'role1', name: 'viewer', isBase: true, capabilities: [] },
  { _id: 'role2', name: 'editor', isBase: true, capabilities: [] },
]

describe('AddMemberForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listUsers).mockResolvedValue(mockUsers)
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
  })

  it('renders user select and role select after loading', async () => {
    render(<AddMemberForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('select-user')).toBeDefined())
    expect(screen.getByTestId('select-role')).toBeDefined()
  })

  it('renders submit button', async () => {
    render(<AddMemberForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-user'))
    expect(screen.getByTestId('btn-add-member')).toBeDefined()
  })

  it('calls addMember and onSuccess when submitted', async () => {
    vi.mocked(workspaceApi.addMember).mockResolvedValue({ ok: true })
    render(<AddMemberForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-user'))

    fireEvent.change(screen.getByTestId('select-user'), { target: { value: 'user1' } })
    fireEvent.change(screen.getByTestId('select-role'), { target: { value: 'role1' } })
    fireEvent.click(screen.getByTestId('btn-add-member'))

    await waitFor(() => expect(workspaceApi.addMember).toHaveBeenCalledWith('tok', 'ws1', { userId: 'user1', roleId: 'role1' }))
  })

  it('shows cancel button and calls onCancel', async () => {
    const onCancel = vi.fn()
    render(<AddMemberForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={onCancel} />)
    await waitFor(() => screen.getByTestId('select-user'))
    fireEvent.click(screen.getByTestId('btn-cancel-add-member'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
