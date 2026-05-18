// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionsList } from '../components/root/sessions-list'
import * as rootApi from '../lib/root-api'

vi.mock('../lib/root-api')

const mockSessions: rootApi.SessionSummary[] = [
  {
    _id: 'sess1',
    userId: 'user_abc123',
    orgId: 'org1',
    deviceInfo: 'Mozilla/5.0 Chrome/120',
    ip: '192.168.1.1',
    expiresAt: Date.now() + 1000 * 60 * 60,
    createdAt: Date.now() - 1000 * 60 * 10,
  },
  {
    _id: 'sess2',
    userId: 'user_def456',
    orgId: 'org2',
    ip: '10.0.0.1',
    expiresAt: Date.now() + 1000 * 60 * 30,
    createdAt: Date.now() - 1000 * 60 * 5,
  },
]

describe('SessionsList', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders loading skeleton while fetching', () => {
    vi.mocked(rootApi.listSessions).mockReturnValue(new Promise(() => {}))
    render(<SessionsList token="tok" />)
    expect(screen.getByTestId('sessions-loading')).toBeDefined()
  })

  it('renders session rows after loading', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('session-row-sess1'))
    expect(screen.getByTestId('session-row-sess2')).toBeDefined()
  })

  it('renders userId in monospace font class', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('session-userid-sess1'))
    const userId = screen.getByTestId('session-userid-sess1')
    expect(userId.className).toContain('font-mono')
  })

  it('renders IP in monospace font class', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('session-ip-sess1'))
    const ip = screen.getByTestId('session-ip-sess1')
    expect(ip.className).toContain('font-mono')
    expect(ip.textContent).toContain('192.168.1.1')
  })

  it('renders empty state when no sessions', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue([])
    render(<SessionsList token="tok" />)
    await waitFor(() => expect(screen.getByTestId('sessions-empty')).toBeDefined())
  })

  it('shows filter inputs for userId and orgId', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => expect(screen.getByTestId('filter-user-id')).toBeDefined())
    expect(screen.getByTestId('filter-org-id')).toBeDefined()
  })

  it('opens revoke confirmation modal on revoke button click', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('session-row-sess1'))
    await userEvent.click(screen.getByTestId('btn-revoke-sess1'))
    expect(screen.getByTestId('modal-revoke-session')).toBeDefined()
  })

  it('calls revokeSession and refreshes list after confirmation', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    vi.mocked(rootApi.revokeSession).mockResolvedValue(undefined)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-revoke-sess1'))
    await userEvent.click(screen.getByTestId('btn-revoke-sess1'))
    await userEvent.click(screen.getByTestId('btn-confirm-revoke'))
    await waitFor(() =>
      expect(vi.mocked(rootApi.revokeSession)).toHaveBeenCalledWith('tok', 'sess1'),
    )
  })

  it('closes revoke modal on cancel', async () => {
    vi.mocked(rootApi.listSessions).mockResolvedValue(mockSessions)
    render(<SessionsList token="tok" />)
    await waitFor(() => screen.getByTestId('btn-revoke-sess1'))
    await userEvent.click(screen.getByTestId('btn-revoke-sess1'))
    await userEvent.click(screen.getByTestId('btn-cancel-revoke'))
    expect(screen.queryByTestId('modal-revoke-session')).toBeNull()
    expect(vi.mocked(rootApi.revokeSession)).not.toHaveBeenCalled()
  })
})
