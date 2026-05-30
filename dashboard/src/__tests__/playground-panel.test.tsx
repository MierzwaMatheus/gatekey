// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlaygroundPanel } from '../components/workspace/playground-panel'
import * as orgApi from '../lib/org-api'

vi.mock('../lib/org-api')

const DEFAULT_PROPS = { token: 'tok', wsId: 'ws1', orgId: 'org1' }

describe('PlaygroundPanel — estrutura básica', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
  })

  it('renderiza o painel principal', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('playground-panel')).toBeDefined()
  })
})

describe('PlaygroundPanel — seletor de método e endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
  })

  it('renderiza select de método com as 4 opções', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select') as HTMLSelectElement
    expect(select).toBeDefined()
    const options = Array.from(select.options).map((o) => o.value)
    expect(options).toContain('GET')
    expect(options).toContain('POST')
    expect(options).toContain('PATCH')
    expect(options).toContain('DELETE')
  })

  it('renderiza input de endpoint', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('endpoint-input') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.placeholder).toContain('/v1/')
  })

  it('método padrão é GET', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select') as HTMLSelectElement
    expect(select.value).toBe('GET')
  })
})

describe('PlaygroundPanel — editor de body JSON', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
  })

  it('oculta textarea de body quando método é GET', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    expect(screen.queryByTestId('body-editor')).toBeNull()
  })

  it('exibe textarea de body quando método é POST', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select')
    await userEvent.selectOptions(select, 'POST')
    expect(screen.getByTestId('body-editor')).toBeDefined()
  })

  it('exibe erro quando JSON é inválido', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select')
    await userEvent.selectOptions(select, 'POST')
    const textarea = screen.getByTestId('body-editor')
    fireEvent.change(textarea, { target: { value: 'not-json-invalid' } })
    expect(screen.getByTestId('body-json-error')).toBeDefined()
  })

  it('não exibe erro quando JSON é válido', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select')
    await userEvent.selectOptions(select, 'POST')
    const textarea = screen.getByTestId('body-editor')
    fireEvent.change(textarea, { target: { value: '{"a":1}' } })
    expect(screen.queryByTestId('body-json-error')).toBeNull()
  })
})

describe('PlaygroundPanel — seletor de API Key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mostra loading enquanto busca keys', () => {
    vi.mocked(orgApi.listApiKeys).mockReturnValue(new Promise(() => {}))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    expect(screen.getByTestId('apikey-loading')).toBeDefined()
  })

  it('renderiza select de API Key com as keys ativas', async () => {
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([
      { _id: 'k1', publicId: 'pk_abc', description: 'My Key', scopes: ['check'], status: 'active', lastUsedAt: null, lastUsedIp: null },
    ])
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = await screen.findByTestId('apikey-select')
    expect(select).toBeDefined()
    expect(screen.getByText('My Key — pk_abc')).toBeDefined()
  })

  it('mostra mensagem quando nenhuma key disponível', async () => {
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-empty')
  })
})

describe('PlaygroundPanel — envio e resposta', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([
      { _id: 'k1', publicId: 'pk_abc', description: 'Key', scopes: ['check'], status: 'active', lastUsedAt: null, lastUsedIp: null },
    ])
  })

  it('exibe painel de resposta após envio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ allowed: true }),
    }))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-send'))
    const panel = await screen.findByTestId('response-panel')
    expect(panel).toBeDefined()
    vi.unstubAllGlobals()
  })

  it('exibe badge de status HTTP 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    }))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-send'))
    const badge = await screen.findByTestId('response-status')
    expect(badge.textContent).toContain('200')
    vi.unstubAllGlobals()
  })

  it('exibe badge 4xx em vermelho', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 403,
      json: async () => ({ error: 'forbidden' }),
    }))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-send'))
    const badge = await screen.findByTestId('response-status')
    expect(badge.textContent).toContain('403')
    vi.unstubAllGlobals()
  })

  it('trata erro de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-send'))
    const panel = await screen.findByTestId('response-panel')
    expect(panel.textContent).toContain('Network error')
    vi.unstubAllGlobals()
  })
})

describe('PlaygroundPanel — histórico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([
      { _id: 'k1', publicId: 'pk_abc', description: 'Key', scopes: ['check'], status: 'active', lastUsedAt: null, lastUsedIp: null },
    ])
  })

  it('exibe lista de histórico após envio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    }))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    const input = screen.getByTestId('endpoint-input')
    await userEvent.clear(input)
    await userEvent.type(input, '/v1/check')
    await userEvent.click(screen.getByTestId('btn-send'))
    await screen.findByTestId('history-list')
    vi.unstubAllGlobals()
  })

  it('clicar em item do histórico repopula os campos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ ok: true }),
    }))
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    const input = screen.getByTestId('endpoint-input') as HTMLInputElement
    await userEvent.clear(input)
    await userEvent.type(input, '/v1/roles')
    await userEvent.click(screen.getByTestId('btn-send'))
    const histList = await screen.findByTestId('history-list')
    const firstItem = histList.querySelector('[data-testid^="history-item-"]') as HTMLElement
    await userEvent.click(firstItem)
    expect(input.value).toBe('/v1/roles')
    vi.unstubAllGlobals()
  })
})

describe('PlaygroundPanel — copy as cURL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([
      { _id: 'k1', publicId: 'pk_abc', description: 'Key', scopes: ['check'], status: 'active', lastUsedAt: null, lastUsedIp: null },
    ])
  })

  it('botão copy as cURL existe', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    expect(screen.getByTestId('btn-copy-curl')).toBeDefined()
  })

  it('copia comando curl correto para clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    const input = screen.getByTestId('endpoint-input')
    await userEvent.clear(input)
    await userEvent.type(input, '/v1/check')
    await userEvent.click(screen.getByTestId('btn-copy-curl'))
    expect(writeText).toHaveBeenCalled()
    const cmd = writeText.mock.calls[0][0] as string
    expect(cmd).toContain('curl')
    expect(cmd).toContain('/v1/check')
    vi.unstubAllGlobals()
  })

  it('cURL para GET não inclui -d', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-copy-curl'))
    const cmd = writeText.mock.calls[0][0] as string
    expect(cmd).not.toContain(" -d '")
    vi.unstubAllGlobals()
  })
})

describe('PlaygroundPanel — copy as SDK call', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([
      { _id: 'k1', publicId: 'pk_abc', description: 'Key', scopes: ['check'], status: 'active', lastUsedAt: null, lastUsedIp: null },
    ])
  })

  it('botão copy as SDK call existe', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    expect(screen.getByTestId('btn-copy-sdk')).toBeDefined()
  })

  it('copia código SDK para clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    await screen.findByTestId('apikey-select')
    await userEvent.click(screen.getByTestId('btn-copy-sdk'))
    expect(writeText).toHaveBeenCalled()
    const code = writeText.mock.calls[0][0] as string
    expect(code).toContain('client')
    vi.unstubAllGlobals()
  })
})

describe('PlaygroundPanel — documentação inline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
  })

  it('painel de docs aparece para endpoint conhecido', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const select = screen.getByTestId('method-select')
    await userEvent.selectOptions(select, 'POST')
    const input = screen.getByTestId('endpoint-input')
    await userEvent.clear(input)
    await userEvent.type(input, '/v1/check')
    expect(screen.getByTestId('docs-panel')).toBeDefined()
  })

  it('painel de docs não aparece para endpoint desconhecido', async () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const input = screen.getByTestId('endpoint-input')
    await userEvent.clear(input)
    await userEvent.type(input, '/v1/naoexiste')
    expect(screen.queryByTestId('docs-panel')).toBeNull()
  })
})

// ── Ciclo 12: link para documentação ─────────────────────────────────────────

describe('PlaygroundPanel — link para documentação OpenAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(orgApi.listApiKeys).mockResolvedValue([])
  })

  it('renderiza link "Ver documentação" apontando para /v1/docs', () => {
    render(<PlaygroundPanel {...DEFAULT_PROPS} />)
    const link = screen.getByTestId('link-docs') as HTMLAnchorElement
    expect(link).toBeDefined()
    expect(link.href).toContain('/v1/docs')
  })
})
