// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ApiKeysBrowser } from '../components/root/api-keys-browser'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockKeys: rootApi.ApiKeySummary[] = [
  {
    _id: 'key1',
    publicId: 'gk_live_pk_abc123def456ghi',
    scopes: ['check', 'users:read', 'bindings:write'],
    description: 'Chave de produção',
    lastUsedAt: Date.now() - 1000 * 60 * 30,
    status: 'active',
  },
  {
    _id: 'key2',
    publicId: 'gk_live_pk_xyz789uvw012rst',
    scopes: ['check'],
    description: 'Chave de leitura',
    status: 'active',
  },
]

describe('ApiKeysBrowser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading skeleton while fetching', () => {
    vi.mocked(rootApi.listApiKeys).mockReturnValue(new Promise(() => {}))
    render(<ApiKeysBrowser token="tok" />)
    expect(screen.getByTestId('apikeys-loading')).toBeDefined()
  })

  it('renders API key cards after loading', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue(mockKeys)
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => screen.getByTestId('apikey-card-key1'))
    expect(screen.getByTestId('apikey-card-key2')).toBeDefined()
  })

  it('renders masked publicId in monospace', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue(mockKeys)
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => screen.getByTestId('apikey-publicid-key1'))
    const pid = screen.getByTestId('apikey-publicid-key1')
    expect(pid.className).toContain('font-mono')
    expect(pid.textContent).toContain('gk_live_pk_')
    expect(pid.textContent).toContain('••••')
  })

  it('renders SVG key visual with scope teeth', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue(mockKeys)
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => screen.getByTestId('key-svg-key1'))
    expect(screen.getByTestId('key-svg-key1')).toBeDefined()
  })

  it('renders scope pills for each scope', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue(mockKeys)
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => screen.getByTestId('scope-check-key1'))
    expect(screen.getByTestId('scope-users:read-key1')).toBeDefined()
    expect(screen.getByTestId('scope-bindings:write-key1')).toBeDefined()
  })

  it('renders ACTIVE status pill', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue(mockKeys)
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => screen.getByTestId('apikey-status-key1'))
    expect(screen.getByTestId('apikey-status-key1').textContent).toContain('ACTIVE')
  })

  it('renders empty state when no keys', async () => {
    vi.mocked(rootApi.listApiKeys).mockResolvedValue([])
    render(<ApiKeysBrowser token="tok" />)
    await waitFor(() => expect(screen.getByTestId('apikeys-empty')).toBeDefined())
  })
})
