// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ResourceTypesList } from '../components/workspace/resource-types-list'
import { CreateResourceTypeForm } from '../components/workspace/create-resource-type-form'
import * as workspaceApi from '../lib/workspace-api'

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
