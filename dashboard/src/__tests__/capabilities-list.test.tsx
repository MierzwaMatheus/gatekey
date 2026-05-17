import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CapabilitiesList } from '../components/root/capabilities-list'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockCapabilities: rootApi.Capability[] = [
  { _id: 'cap1', name: 'document:read', description: 'Ler documentos', isBase: true },
  { _id: 'cap2', name: 'document:write', description: 'Escrever documentos', isBase: true },
  { _id: 'cap3', name: 'user:invite', description: 'Convidar usuários', isBase: true },
  { _id: 'cap4', name: 'billing:view', description: 'Ver cobrança', isBase: true },
  { _id: 'cap5', name: 'report:export', description: 'Exportar relatórios', isBase: true },
]

describe('CapabilitiesList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading state while fetching', () => {
    vi.mocked(rootApi.listCapabilities).mockReturnValue(new Promise(() => {}))
    render(<CapabilitiesList token="tok" />)
    expect(screen.getByTestId('capabilities-loading')).toBeDefined()
  })

  it('renders capability badges after loading', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: mockCapabilities })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => screen.getByTestId('cap-badge-cap1'))
    expect(screen.getByTestId('cap-badge-cap1').textContent).toContain('document:read')
    expect(screen.getByTestId('cap-badge-cap2')).toBeDefined()
    expect(screen.getByTestId('cap-badge-cap5')).toBeDefined()
  })

  it('renders capability names in monospace', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: mockCapabilities })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => screen.getByTestId('cap-badge-cap1'))
    expect(screen.getByTestId('cap-badge-cap1').className).toContain('font-mono')
  })

  it('renders empty state with octagon SVG when no capabilities', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: [] })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => expect(screen.getByTestId('capabilities-empty')).toBeDefined())
  })

  it('renders add capability form with name and description fields', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: mockCapabilities })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => expect(screen.getByTestId('input-cap-name')).toBeDefined())
    expect(screen.getByTestId('input-cap-description')).toBeDefined()
    expect(screen.getByTestId('btn-add-capability')).toBeDefined()
  })

  it('calls createCapability with correct data on submit', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: mockCapabilities })
    vi.mocked(rootApi.createCapability).mockResolvedValue({
      _id: 'cap6', name: 'custom:action', description: 'Nova cap', isBase: false,
    })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => screen.getByTestId('input-cap-name'))
    await userEvent.type(screen.getByTestId('input-cap-name'), 'custom:action')
    await userEvent.type(screen.getByTestId('input-cap-description'), 'Nova cap')
    await userEvent.click(screen.getByTestId('btn-add-capability'))
    await waitFor(() =>
      expect(vi.mocked(rootApi.createCapability)).toHaveBeenCalledWith('tok', {
        name: 'custom:action',
        description: 'Nova cap',
      }),
    )
  })

  it('resets form and refreshes list after successful add', async () => {
    vi.mocked(rootApi.listCapabilities).mockResolvedValue({ capabilities: mockCapabilities })
    vi.mocked(rootApi.createCapability).mockResolvedValue({
      _id: 'cap6', name: 'custom:action', description: 'Nova', isBase: false,
    })
    render(<CapabilitiesList token="tok" />)
    await waitFor(() => screen.getByTestId('input-cap-name'))
    await userEvent.type(screen.getByTestId('input-cap-name'), 'custom:action')
    await userEvent.type(screen.getByTestId('input-cap-description'), 'Nova')
    await userEvent.click(screen.getByTestId('btn-add-capability'))
    await waitFor(() => {
      expect((screen.getByTestId('input-cap-name') as HTMLInputElement).value).toBe('')
    })
  })
})
