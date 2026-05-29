// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { RolesList } from '../components/workspace/roles-list'
import { CreateRoleForm } from '../components/workspace/create-role-form'
import * as workspaceApi from '../lib/workspace-api'

vi.mock('../lib/workspace-api')

const mockRoles = [
  { _id: 'role1', name: 'viewer', isBase: true, capabilities: ['document:read'] },
  { _id: 'role2', name: 'custom-role', isBase: false, capabilities: ['document:read', 'document:write'] },
]

const mockCapabilities = {
  capabilities: [
    { _id: 'cap1', name: 'document:read', description: 'Read documents', isBase: true },
    { _id: 'cap2', name: 'document:write', description: 'Write documents', isBase: true },
  ],
}

describe('RolesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listCapabilities).mockResolvedValue(mockCapabilities)
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(workspaceApi.listRoles).mockReturnValue(new Promise(() => {}))
    render(<RolesList token="tok" wsId="ws1" />)
    expect(screen.getByTestId('roles-loading')).toBeDefined()
  })

  it('renders role rows after loading', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByText('viewer')).toBeDefined())
    expect(screen.getByText('custom-role')).toBeDefined()
  })

  it('shows capabilities for each role', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByText('viewer'))
    expect(screen.getByText('document:read')).toBeDefined()
  })

  it('renders empty state when no roles', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue([])
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => expect(screen.getByTestId('roles-empty')).toBeDefined())
  })

  it('shows delete button only for non-base roles', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByText('custom-role'))
    expect(screen.queryByTestId('btn-delete-role2')).toBeDefined()
    expect(screen.queryByTestId('btn-delete-role1')).toBeNull()
  })

  it('shows duplicate button only for non-base roles', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByText('custom-role'))
    expect(screen.queryByTestId('btn-duplicate-role2')).toBeDefined()
    expect(screen.queryByTestId('btn-duplicate-role1')).toBeNull()
  })

  it('does not show duplicate button for base roles', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByText('viewer'))
    expect(screen.queryByTestId('btn-duplicate-role1')).toBeNull()
  })

  it('calls duplicateRole with correct roleId when Duplicar is clicked', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    vi.mocked(workspaceApi.duplicateRole).mockResolvedValue({
      id: 'role3',
      name: 'Cópia de custom-role',
      isBase: false,
      capabilities: ['cap1'],
    })
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('btn-duplicate-role2'))
    fireEvent.click(screen.getByTestId('btn-duplicate-role2'))
    await waitFor(() => expect(workspaceApi.duplicateRole).toHaveBeenCalledWith('tok', 'role2', 'ws1'))
  })

  it('shows new duplicated role in list after duplication', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    vi.mocked(workspaceApi.duplicateRole).mockResolvedValue({
      id: 'role3',
      name: 'Cópia de custom-role',
      isBase: false,
      capabilities: ['cap1'],
    })
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('btn-duplicate-role2'))
    fireEvent.click(screen.getByTestId('btn-duplicate-role2'))
    await waitFor(() => {
      const input = screen.queryByTestId('inline-rename-role3') as HTMLInputElement | null
      const text = screen.queryByText('Cópia de custom-role')
      expect(input?.value === 'Cópia de custom-role' || !!text).toBe(true)
    })
  })

  it('new duplicated role name is immediately editable inline', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    vi.mocked(workspaceApi.duplicateRole).mockResolvedValue({
      id: 'role3',
      name: 'Cópia de custom-role',
      isBase: false,
      capabilities: ['cap1'],
    })
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('btn-duplicate-role2'))
    fireEvent.click(screen.getByTestId('btn-duplicate-role2'))
    await waitFor(() => expect(screen.getByTestId('inline-rename-role3')).toBeDefined())
  })

  it('shows quota error when duplication exceeds workspace limit', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    vi.mocked(workspaceApi.duplicateRole).mockRejectedValue(new Error('QuotaExceeded'))
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('btn-duplicate-role2'))
    fireEvent.click(screen.getByTestId('btn-duplicate-role2'))
    await waitFor(() => expect(screen.getByTestId('duplicate-role-error')).toBeDefined())
  })

  it('shows blocked message when delete returns 409', async () => {
    vi.mocked(workspaceApi.listRoles).mockResolvedValue(mockRoles)
    vi.mocked(workspaceApi.deleteRole).mockRejectedValue(new Error('active_bindings'))
    render(<RolesList token="tok" wsId="ws1" />)
    await waitFor(() => screen.getByTestId('btn-delete-role2'))
    fireEvent.click(screen.getByTestId('btn-delete-role2'))
    await waitFor(() => screen.getByTestId('delete-role-modal'))
    fireEvent.click(screen.getByTestId('btn-confirm-delete-role'))
    await waitFor(() => expect(screen.getByTestId('delete-role-error')).toBeDefined())
  })
})

describe('CreateRoleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listCapabilities).mockResolvedValue(mockCapabilities)
  })

  it('renders role name input and capability checkboxes', async () => {
    render(<CreateRoleForm token="tok" wsId="ws1" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('input-role-name')).toBeDefined())
    expect(screen.getByTestId('cap-check-cap1')).toBeDefined()
    expect(screen.getByTestId('cap-check-cap2')).toBeDefined()
  })

  it('submits with role name and selected capabilities', async () => {
    vi.mocked(workspaceApi.createRole).mockResolvedValue({ id: 'new-role' })
    const onSuccess = vi.fn()
    render(<CreateRoleForm token="tok" wsId="ws1" onSuccess={onSuccess} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('input-role-name'))

    fireEvent.change(screen.getByTestId('input-role-name'), { target: { value: 'my-role' } })
    fireEvent.click(screen.getByTestId('cap-check-cap1'))
    fireEvent.click(screen.getByTestId('btn-create-role'))

    await waitFor(() => expect(workspaceApi.createRole).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ name: 'my-role', workspaceId: 'ws1' })
    ))
  })
})

describe('CreateRoleForm — modo de edição', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listCapabilities).mockResolvedValue(mockCapabilities)
  })

  it('oculta input de nome no modo de edição', async () => {
    render(
      <CreateRoleForm
        token="tok"
        wsId="ws1"
        onSuccess={() => {}}
        onCancel={() => {}}
        roleId="role2"
        initialCapabilities={['cap1']}
      />
    )
    await waitFor(() => screen.getByTestId('cap-check-cap1'))
    expect(screen.queryByTestId('input-role-name')).toBeNull()
  })

  it('pré-seleciona as capabilities iniciais no modo de edição', async () => {
    render(
      <CreateRoleForm
        token="tok"
        wsId="ws1"
        onSuccess={() => {}}
        onCancel={() => {}}
        roleId="role2"
        initialCapabilities={['cap1']}
      />
    )
    await waitFor(() => screen.getByTestId('cap-check-cap1'))
    const cap1 = screen.getByTestId('cap-check-cap1') as HTMLInputElement
    const cap2 = screen.getByTestId('cap-check-cap2') as HTMLInputElement
    expect(cap1.checked).toBe(true)
    expect(cap2.checked).toBe(false)
  })

  it('exibe botão "Salvar" em vez de "Criar" no modo de edição', async () => {
    render(
      <CreateRoleForm
        token="tok"
        wsId="ws1"
        onSuccess={() => {}}
        onCancel={() => {}}
        roleId="role2"
        initialCapabilities={[]}
      />
    )
    await waitFor(() => screen.getByTestId('btn-save-role'))
    expect(screen.queryByTestId('btn-create-role')).toBeNull()
  })
})
