// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColdStorageDownload } from '../components/org/cold-storage-download'

function mockFetchSuccess(downloadUrl = 'https://r2.example.com/logs.ndjson.gz') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      downloadUrl,
      expiresAt: Date.now() + 15 * 60 * 1000,
      period: { start: 0, end: 1 },
    }),
  }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ColdStorageDownload', () => {
  it('renderiza date pickers e botão de gerar link', () => {
    render(<ColdStorageDownload token="tok" orgId="org1" isConfigured />)
    expect(screen.getByLabelText(/data início/i)).toBeDefined()
    expect(screen.getByLabelText(/data fim/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /gerar link/i })).toBeDefined()
  })

  it('exibe mensagem de não configurado quando isConfigured=false', () => {
    render(<ColdStorageDownload token="tok" orgId="org1" isConfigured={false} />)
    expect(screen.getByText(/cold storage não configurado/i)).toBeDefined()
  })

  it('exibe URL retornada pela API após clicar em gerar', async () => {
    const mockUrl = 'https://r2.example.com/org1/2024/01/31/logs.ndjson.gz?X-Amz-Expires=900'
    mockFetchSuccess(mockUrl)

    render(<ColdStorageDownload token="tok" orgId="org1" isConfigured />)

    fireEvent.change(screen.getByLabelText(/data início/i), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(/data fim/i), { target: { value: '2024-01-31' } })

    await userEvent.click(screen.getByRole('button', { name: /gerar link/i }))

    await waitFor(() => {
      expect(screen.getByText(mockUrl)).toBeDefined()
    })
  })

  it('exibe contador de expiração após gerar link', async () => {
    mockFetchSuccess()

    render(<ColdStorageDownload token="tok" orgId="org1" isConfigured />)
    fireEvent.change(screen.getByLabelText(/data início/i), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(/data fim/i), { target: { value: '2024-01-31' } })
    await userEvent.click(screen.getByRole('button', { name: /gerar link/i }))

    await waitFor(() => {
      expect(screen.getByTestId('expiry-countdown')).toBeDefined()
    })
  })

  it('botão copiar exibe "Copiado" após click', async () => {
    mockFetchSuccess()
    const mockClipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
    Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, configurable: true })

    render(<ColdStorageDownload token="tok" orgId="org1" isConfigured />)
    fireEvent.change(screen.getByLabelText(/data início/i), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(/data fim/i), { target: { value: '2024-01-31' } })
    await userEvent.click(screen.getByRole('button', { name: /gerar link/i }))

    await waitFor(() => expect(screen.getByRole('button', { name: /copiar/i })).toBeDefined())
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))

    await waitFor(() => expect(screen.getByText(/copiado/i)).toBeDefined())
  })
})
