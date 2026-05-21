// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { BindingsList } from '../components/workspace/bindings-list'
import { CreateBindingForm } from '../components/workspace/create-binding-form'
import * as workspaceApi from '../lib/workspace-api'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/workspace-api')
vi.mock('../lib/org-api')

const mockBindings = [
  { _id: 'bind1', userId: 'user1', roleId: 'role1', roleName: 'viewer', resourceType: 'workspace', resourceId: undefined, workspaceId: 'ws1' },
  { _id: 'bind2', userId: 'user2', roleId: 'role2', roleName: 'editor', resourceType: 'document', resourceId: 'doc-123', workspaceId: 'ws1' },
]

const mockRoles = [
  { _id: 'role1', name: 'viewer', isBase: true, capabilities: [] },
  { _id: 'role2', name: 'editor', isBase: false, capabilities: [] },
]

const mockUsers = [
  { _id: 'user1', email: 'alice@acme.com', status: 'active' as const, loginAttempts: 0, updatedAt: 0, orgRole: 'member', orgStatus: 'active' },
]

describe('BindingsList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(workspaceApi.listBindings).mockReturnValue(new Promise(() => {}))
    render(<BindingsList token="tok" wsId="ws1" />)
    expect(screen.getByTestId('bindings-loading')).toBeDefined()
  })

  it('renders binding rows after loading', async () => {
    vi.mocked(workspaceApi.listBindings).mockResolvedValue(mockBindings)
    render(<BindingsList token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByTestId('binding-row-bind1')).toBeDefined())
    expect(screen.getByTestId('binding-row-bind2')).toBeDefined()
  })

  it('shows "workspace inteiro" when resourceId is absent', async () => {
    vi.mocked(workspaceApi.listBindings).mockResolvedValue(mockBindings)
    render(<BindingsList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('binding-row-bind1'))
    expect(screen.getByText('workspace inteiro')).toBeDefined()
  })

  it('shows resourceId when present', async () => {
    vi.mocked(workspaceApi.listBindings).mockResolvedValue(mockBindings)
    render(<BindingsList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('binding-row-bind2'))
    expect(screen.getByText('doc-123')).toBeDefined()
  })

  it('renders empty state when no bindings', async () => {
    vi.mocked(workspaceApi.listBindings).mockResolvedValue([])
    render(<BindingsList token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByTestId('bindings-empty')).toBeDefined())
  })

  it('shows revoke confirmation modal and calls deleteBinding', async () => {
    vi.mocked(workspaceApi.listBindings).mockResolvedValue(mockBindings)
    vi.mocked(workspaceApi.deleteBinding).mockResolvedValue(undefined)
    render(<BindingsList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('binding-row-bind1'))
    fireEvent.click(screen.getByTestId('btn-revoke-bind1'))
    await waitFor(() => screen.getByTestId('revoke-binding-modal'))
    fireEvent.click(screen.getByTestId('btn-confirm-revoke'))
    await waitFor(() => expect(workspaceApi.deleteBinding).toHaveBeenCalledWith('tok', 'bind1'))
  })
})

describe('CreateBindingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listUsers).mockResolvedValue(mockUsers)
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
  })

  it('renders user select, role select, resource type field and optional resource id', async () => {
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('select-binding-user')).toBeDefined())
    expect(screen.getByTestId('select-binding-role')).toBeDefined()
    expect(screen.getByTestId('input-resource-type')).toBeDefined()
    expect(screen.getByTestId('input-resource-id')).toBeDefined()
  })

  it('renders type selector with "Permitir" and "Negar" options', async () => {
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))
    const typeSelect = screen.getByTestId('select-binding-type')
    expect(typeSelect).toBeDefined()
    expect(screen.getByText('Permitir (allow)')).toBeDefined()
    expect(screen.getByText('Negar (deny)')).toBeDefined()
  })

  it('applies danger style when "Negar" is selected', async () => {
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))
    fireEvent.change(screen.getByTestId('select-binding-type'), { target: { value: 'deny' } })
    const form = screen.getByTestId('binding-form')
    expect(form.className).toContain('border-red')
  })

  it('shows precedence warning when "Negar" is selected', async () => {
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))
    fireEvent.change(screen.getByTestId('select-binding-type'), { target: { value: 'deny' } })
    expect(screen.getByTestId('deny-warning')).toBeDefined()
    expect(screen.getByText(/precedência absoluta/)).toBeDefined()
  })

  it('does not show warning when "Permitir" is selected', async () => {
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))
    expect(screen.queryByTestId('deny-warning')).toBeNull()
  })

  it('submits binding data when form is submitted', async () => {
    vi.mocked(workspaceApi.createBinding).mockResolvedValue({ id: 'new-bind' })
    const onSuccess = vi.fn()
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={onSuccess} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))

    fireEvent.change(screen.getByTestId('select-binding-user'), { target: { value: 'user1' } })
    fireEvent.change(screen.getByTestId('select-binding-role'), { target: { value: 'role1' } })
    fireEvent.change(screen.getByTestId('input-resource-type'), { target: { value: 'workspace' } })
    fireEvent.click(screen.getByTestId('btn-create-binding'))

    await waitFor(() => expect(workspaceApi.createBinding).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ userId: 'user1', roleId: 'role1', resourceType: 'workspace', workspaceId: 'ws1' })
    ))
  })

  it('submits with type "deny" when deny is selected', async () => {
    vi.mocked(workspaceApi.createBinding).mockResolvedValue({ id: 'new-bind' })
    render(<CreateBindingForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('select-binding-user'))

    fireEvent.change(screen.getByTestId('select-binding-type'), { target: { value: 'deny' } })
    fireEvent.change(screen.getByTestId('select-binding-user'), { target: { value: 'user1' } })
    fireEvent.change(screen.getByTestId('select-binding-role'), { target: { value: 'role1' } })
    fireEvent.change(screen.getByTestId('input-resource-type'), { target: { value: 'document' } })
    fireEvent.click(screen.getByTestId('btn-create-binding'))

    await waitFor(() => expect(workspaceApi.createBinding).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ type: 'deny' })
    ))
  })
})
