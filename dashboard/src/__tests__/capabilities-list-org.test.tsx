// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CapabilitiesListOrg } from '../components/org/capabilities-list-org'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

const mockCaps: orgApi.Capability[] = [
  { _id: 'base1', name: 'document:read', description: 'Read docs', isBase: true },
  { _id: 'custom1', name: 'pipeline:deploy', description: 'Deploy', isBase: false, orgId: 'org1' },
  { _id: 'custom2', name: 'report:export', description: 'Export', isBase: false, orgId: 'org1' },
]

describe('CapabilitiesListOrg — delete guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('botão Remover está desabilitado quando capability está em uso', async () => {
    vi.mocked(orgApi.listCapabilities).mockResolvedValue({ capabilities: mockCaps })
    vi.mocked(orgApi.getCapabilityUsage).mockImplementation((_token, capId) => {
      if (capId === 'custom1') return Promise.resolve({ roles: [{ roleId: 'r1', roleName: 'reader' }] })
      return Promise.resolve({ roles: [] })
    })

    render(<CapabilitiesListOrg token="tok" />)
    await waitFor(() => screen.getByTestId('remove-cap-custom1'))

    const btn = screen.getByTestId('remove-cap-custom1') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('tooltip no botão desabilitado exibe nome do role', async () => {
    vi.mocked(orgApi.listCapabilities).mockResolvedValue({ capabilities: mockCaps })
    vi.mocked(orgApi.getCapabilityUsage).mockImplementation((_token, capId) => {
      if (capId === 'custom1') return Promise.resolve({ roles: [{ roleId: 'r1', roleName: 'reader' }] })
      return Promise.resolve({ roles: [] })
    })

    render(<CapabilitiesListOrg token="tok" />)
    await waitFor(() => screen.getByTestId('remove-cap-custom1'))

    const btn = screen.getByTestId('remove-cap-custom1')
    expect(btn.getAttribute('title')).toContain('reader')
  })

  it('botão Remover habilitado quando capability não está em uso', async () => {
    vi.mocked(orgApi.listCapabilities).mockResolvedValue({ capabilities: mockCaps })
    vi.mocked(orgApi.getCapabilityUsage).mockResolvedValue({ roles: [] })

    render(<CapabilitiesListOrg token="tok" />)
    await waitFor(() => screen.getByTestId('remove-cap-custom2'))

    const btn = screen.getByTestId('remove-cap-custom2') as HTMLButtonElement
    expect(btn.disabled).toBe(false)
  })

  it('clique em Remover (não em uso) chama deleteCapability após confirmação', async () => {
    vi.mocked(orgApi.listCapabilities).mockResolvedValue({ capabilities: mockCaps })
    vi.mocked(orgApi.getCapabilityUsage).mockResolvedValue({ roles: [] })
    vi.mocked(orgApi.deleteCapability).mockResolvedValue(undefined)

    render(<CapabilitiesListOrg token="tok" />)
    await waitFor(() => screen.getByTestId('remove-cap-custom2'))

    await userEvent.click(screen.getByTestId('remove-cap-custom2'))

    // Deve aparecer dialog de confirmação
    await waitFor(() => screen.getByTestId('confirm-delete-dialog'))
    await userEvent.click(screen.getByTestId('confirm-delete-btn'))

    await waitFor(() =>
      expect(vi.mocked(orgApi.deleteCapability)).toHaveBeenCalledWith('tok', 'custom2'),
    )
  })

  it('exibe contador "Usada por N roles" por linha em uso', async () => {
    vi.mocked(orgApi.listCapabilities).mockResolvedValue({ capabilities: mockCaps })
    vi.mocked(orgApi.getCapabilityUsage).mockImplementation((_token, capId) => {
      if (capId === 'custom1')
        return Promise.resolve({ roles: [{ roleId: 'r1', roleName: 'reader' }, { roleId: 'r2', roleName: 'editor' }] })
      return Promise.resolve({ roles: [] })
    })

    render(<CapabilitiesListOrg token="tok" />)
    await waitFor(() => screen.getByTestId('usage-count-custom1'))

    expect(screen.getByTestId('usage-count-custom1').textContent).toContain('2')
  })
})
