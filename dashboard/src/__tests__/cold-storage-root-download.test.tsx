// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColdStorageRootDownload } from '../components/root/cold-storage-download'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ColdStorageRootDownload', () => {
  it('renderiza seletor de org, date pickers e botão gerar link', () => {
    render(
      <ColdStorageRootDownload
        token="tok"
        orgs={[{ id: 'org1', name: 'Acme Corp' }, { id: 'org2', name: 'Beta Inc' }]}
        isConfigured
      />
    )
    expect(screen.getByLabelText(/organização/i)).toBeDefined()
    expect(screen.getByLabelText(/data início/i)).toBeDefined()
    expect(screen.getByLabelText(/data fim/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /gerar link/i })).toBeDefined()
  })

  it('exibe mensagem não configurado quando isConfigured=false', () => {
    render(<ColdStorageRootDownload token="tok" orgs={[]} isConfigured={false} />)
    expect(screen.getByText(/cold storage não configurado/i)).toBeDefined()
  })

  it('exibe URL gerada após selecionar org e período', async () => {
    const mockUrl = 'https://r2.example.com/org1/logs.ndjson.gz'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        downloadUrl: mockUrl,
        expiresAt: Date.now() + 15 * 60 * 1000,
        period: { start: 0, end: 1 },
      }),
    }))

    render(
      <ColdStorageRootDownload
        token="tok"
        orgs={[{ id: 'org1', name: 'Acme Corp' }]}
        isConfigured
      />
    )

    fireEvent.change(screen.getByLabelText(/organização/i), { target: { value: 'org1' } })
    fireEvent.change(screen.getByLabelText(/data início/i), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(/data fim/i), { target: { value: '2024-01-31' } })
    await userEvent.click(screen.getByRole('button', { name: /gerar link/i }))

    await waitFor(() => {
      expect(screen.getByText(mockUrl)).toBeDefined()
    })
  })
})
