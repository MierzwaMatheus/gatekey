// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ResourceTypesList } from '../components/workspace/resource-types-list'
import { CreateResourceTypeForm } from '../components/workspace/create-resource-type-form'
import * as workspaceApi from '../lib/workspace-api'
import { checkResourceTypeInheritance, updateResourceTypeInheritance } from '../lib/workspace-api'

vi.mock('../lib/workspace-api')

const mockResourceTypes = [
  { _id: 'rt1', name: 'document', inheritsFrom: 'folder', inheritanceMode: 'full' },
  { _id: 'rt2', name: 'folder', inheritsFrom: undefined, inheritanceMode: undefined },
]

describe('ResourceTypesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton while fetching', () => {
    vi.mocked(workspaceApi.listResourceTypes).mockReturnValue(new Promise(() => {}))
    render(<ResourceTypesList token="tok" />)
    expect(screen.getByTestId('resource-types-loading')).toBeDefined()
  })

  it('renders resource type rows after loading', async () => {
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue(mockResourceTypes)
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => expect(screen.getByText('document')).toBeDefined())
    expect(screen.getAllByText('folder').length).toBeGreaterThanOrEqual(1)
  })

  it('shows inheritsFrom when present', async () => {
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue(mockResourceTypes)
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByText('document'))
    // 'folder' appears as both resource type name and inheritsFrom value
    expect(screen.getAllByText('folder').length).toBeGreaterThanOrEqual(2)
  })

  it('shows inheritanceMode when present', async () => {
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue(mockResourceTypes)
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByText('full'))
  })

  it('renders empty state when no resource types', async () => {
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue([])
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => expect(screen.getByTestId('resource-types-empty')).toBeDefined())
  })
})

describe('CreateResourceTypeForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue(mockResourceTypes)
  })

  it('renders name input', async () => {
    render(<CreateResourceTypeForm token="tok" onSuccess={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('input-rt-name')).toBeDefined()
  })

  it('renders inheritance toggle', async () => {
    render(<CreateResourceTypeForm token="tok" onSuccess={() => {}} onCancel={() => {}} />)
    expect(screen.getByTestId('toggle-inheritance')).toBeDefined()
  })

  it('shows parent selector and mode input when toggle is enabled', async () => {
    render(<CreateResourceTypeForm token="tok" onSuccess={() => {}} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('toggle-inheritance'))
    fireEvent.click(screen.getByTestId('toggle-inheritance'))
    expect(screen.getByTestId('select-parent-type')).toBeDefined()
    expect(screen.getByTestId('input-inheritance-mode')).toBeDefined()
  })

  it('hides parent selector when toggle is disabled', () => {
    render(<CreateResourceTypeForm token="tok" onSuccess={() => {}} onCancel={() => {}} />)
    expect(screen.queryByTestId('select-parent-type')).toBeNull()
  })

  it('submits resource type data', async () => {
    vi.mocked(workspaceApi.createResourceType).mockResolvedValue({ id: 'new-rt' })
    const onSuccess = vi.fn()
    render(<CreateResourceTypeForm token="tok" onSuccess={onSuccess} onCancel={() => {}} />)
    await waitFor(() => screen.getByTestId('input-rt-name'))

    fireEvent.change(screen.getByTestId('input-rt-name'), { target: { value: 'report' } })
    fireEvent.click(screen.getByTestId('btn-create-resource-type'))

    await waitFor(() => expect(workspaceApi.createResourceType).toHaveBeenCalledWith(
      'tok',
      expect.objectContaining({ name: 'report' })
    ))
  })
})

describe('ResourceTypesList: toggle de herança e confirmation dialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceApi.listResourceTypes).mockResolvedValue([
      { _id: 'rt1', name: 'document', inheritsFrom: 'folder', inheritanceMode: 'full' },
    ])
    vi.mocked(workspaceApi.checkResourceTypeInheritance).mockResolvedValue({ affectedCount: 0 })
    vi.mocked(workspaceApi.updateResourceTypeInheritance).mockResolvedValue(undefined)
  })

  it('exibe botão de toggle para resource type com inheritanceMode', async () => {
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-toggle-inheritance-rt1'))
  })

  it('salva sem dialog quando não há usuários afetados', async () => {
    vi.mocked(workspaceApi.checkResourceTypeInheritance).mockResolvedValue({ affectedCount: 0 })
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-toggle-inheritance-rt1'))
    fireEvent.click(screen.getByTestId('btn-toggle-inheritance-rt1'))

    await waitFor(() =>
      expect(workspaceApi.updateResourceTypeInheritance).toHaveBeenCalledWith('tok', 'document', null),
    )
    expect(screen.queryByTestId('dialog-inheritance-warning')).toBeNull()
  })

  it('abre dialog quando há usuários afetados', async () => {
    vi.mocked(workspaceApi.checkResourceTypeInheritance).mockResolvedValue({ affectedCount: 3 })
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-toggle-inheritance-rt1'))
    fireEvent.click(screen.getByTestId('btn-toggle-inheritance-rt1'))

    await waitFor(() => screen.getByTestId('dialog-inheritance-warning'))
    expect(screen.getByText(/3/)).toBeDefined()
  })

  it('não salva quando usuário cancela o dialog', async () => {
    vi.mocked(workspaceApi.checkResourceTypeInheritance).mockResolvedValue({ affectedCount: 2 })
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-toggle-inheritance-rt1'))
    fireEvent.click(screen.getByTestId('btn-toggle-inheritance-rt1'))

    await waitFor(() => screen.getByTestId('btn-cancel-inheritance'))
    fireEvent.click(screen.getByTestId('btn-cancel-inheritance'))

    expect(workspaceApi.updateResourceTypeInheritance).not.toHaveBeenCalled()
    expect(screen.queryByTestId('dialog-inheritance-warning')).toBeNull()
  })

  it('salva quando usuário confirma o dialog', async () => {
    vi.mocked(workspaceApi.checkResourceTypeInheritance).mockResolvedValue({ affectedCount: 2 })
    render(<ResourceTypesList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-toggle-inheritance-rt1'))
    fireEvent.click(screen.getByTestId('btn-toggle-inheritance-rt1'))

    await waitFor(() => screen.getByTestId('btn-confirm-inheritance'))
    fireEvent.click(screen.getByTestId('btn-confirm-inheritance'))

    await waitFor(() =>
      expect(workspaceApi.updateResourceTypeInheritance).toHaveBeenCalledWith('tok', 'document', null),
    )
  })
})

describe('workspace-api: checkResourceTypeInheritance e updateResourceTypeInheritance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('checkResourceTypeInheritance é uma função exportada', () => {
    expect(typeof checkResourceTypeInheritance).toBe('function')
  })

  it('updateResourceTypeInheritance é uma função exportada', () => {
    expect(typeof updateResourceTypeInheritance).toBe('function')
  })

})
