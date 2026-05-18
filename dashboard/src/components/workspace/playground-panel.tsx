import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { listApiKeys, type ApiKeySummary } from '../../lib/org-api'

const BASE_URL = (import.meta.env.VITE_CONVEX_SITE_URL ?? import.meta.env.VITE_CONVEX_URL ?? '') as string

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const
type HttpMethod = typeof METHODS[number]

interface HistoryEntry {
  method: HttpMethod
  endpoint: string
  body: string
  status: number
}

interface EndpointDoc {
  description: string
  params: string
  example: string
}

const ENDPOINT_DOCS: Record<string, EndpointDoc> = {
  'POST /v1/check': {
    description: 'Verifica se um usuário tem permissão para executar uma capability em um recurso.',
    params: '{ userId, capability, resourceType, resourceId? }',
    example: '{ "allowed": true }',
  },
  'GET /v1/users': {
    description: 'Lista todos os usuários da organização.',
    params: 'Query: nenhum obrigatório',
    example: '[{ "_id": "...", "email": "...", "status": "active" }]',
  },
  'POST /v1/users': {
    description: 'Cria um novo usuário na organização.',
    params: '{ email, password, name?, role? }',
    example: '{ "_id": "...", "email": "..." }',
  },
  'GET /v1/roles': {
    description: 'Lista os roles do workspace (base + custom).',
    params: 'Query: workspaceId (obrigatório)',
    example: '[{ "_id": "...", "name": "admin", "isBase": true }]',
  },
  'POST /v1/roles': {
    description: 'Cria um role customizado no workspace.',
    params: '{ name, workspaceId, capabilityIds? }',
    example: '{ "_id": "...", "name": "editor" }',
  },
  'GET /v1/bindings': {
    description: 'Lista os bindings do workspace.',
    params: 'Query: workspaceId (obrigatório), userId? (opcional)',
    example: '[{ "_id": "...", "userId": "...", "roleId": "...", "resourceType": "..." }]',
  },
  'POST /v1/bindings': {
    description: 'Cria um binding userId → roleId em um resource.',
    params: '{ userId, roleId, resourceType, resourceId?, workspaceId }',
    example: '{ "_id": "..." }',
  },
  'GET /v1/capabilities': {
    description: 'Lista capabilities da organização (base + custom).',
    params: 'Query: nenhum obrigatório',
    example: '[{ "_id": "...", "name": "document:read", "isBase": true }]',
  },
  'GET /v1/api-keys': {
    description: 'Lista API Keys da organização (sem secrets).',
    params: 'Query: nenhum obrigatório',
    example: '[{ "publicId": "gk_live_pk_...", "scopes": ["check"], "status": "active" }]',
  },
  'GET /v1/audit-log': {
    description: 'Consulta o audit log com filtros e paginação por cursor.',
    params: 'Query: orgId?, workspaceId?, action?, result?, from?, to?, cursor?',
    example: '{ "logs": [...], "isDone": true, "cursor": null }',
  },
  'GET /v1/sessions': {
    description: 'Lista sessões ativas.',
    params: 'Query: userId? (opcional)',
    example: '[{ "_id": "...", "userId": "...", "expiresAt": 1234567890 }]',
  },
  'GET /v1/resource-types': {
    description: 'Lista resource types registrados na organização.',
    params: 'Query: nenhum obrigatório',
    example: '[{ "_id": "...", "name": "document", "inheritsFrom": "folder" }]',
  },
  'POST /v1/resource-types': {
    description: 'Registra um novo resource type.',
    params: '{ name, inheritsFrom?, inheritanceMode? }',
    example: '{ "_id": "..." }',
  },
}

const HISTORY_KEY = 'gk-playground-history'

function loadHistory(): HistoryEntry[] {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]')
  } catch {
    return []
  }
}

export function buildCurlCommand(
  method: HttpMethod,
  endpoint: string,
  body: string,
  apiKeyToken: string,
): string {
  const url = `${BASE_URL}${endpoint}`
  const parts = [
    `curl -X ${method}`,
    `-H "Authorization: Bearer ${apiKeyToken}"`,
    `-H "Content-Type: application/json"`,
  ]
  if (method !== 'GET' && body.trim()) {
    parts.push(`-d '${body.trim()}'`)
  }
  parts.push(`"${url}"`)
  return parts.join(' \\\n  ')
}

export function buildSdkCall(method: HttpMethod, endpoint: string, body: string): string {
  const methodMap: Record<HttpMethod, string> = {
    GET: 'get',
    POST: 'post',
    PATCH: 'patch',
    DELETE: 'delete',
  }
  const m = methodMap[method]
  if (method === 'GET' || method === 'DELETE') {
    return `await client.request.${m}('${endpoint}')`
  }
  const bodyArg = body.trim() || '{}'
  return `await client.request.${m}('${endpoint}', ${bodyArg})`
}

interface PlaygroundPanelProps {
  token: string
  wsId: string
  orgId: string
}

export function PlaygroundPanel({ token }: PlaygroundPanelProps) {
  const { t } = useTranslation('playground')
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [endpoint, setEndpoint] = useState('')
  const [body, setBody] = useState('')
  const [bodyError, setBodyError] = useState(false)

  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null)
  const [selectedKeyId, setSelectedKeyId] = useState('')

  const [response, setResponse] = useState<string | null>(null)
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory)

  useEffect(() => {
    listApiKeys(token).then((res) => {
      const active = res.filter((k) => k.status === 'active')
      setKeys(active)
      if (active.length > 0) setSelectedKeyId(active[0]._id)
    })
  }, [token])

  function validateBody(val: string) {
    if (!val.trim()) {
      setBodyError(false)
      return
    }
    try {
      JSON.parse(val)
      setBodyError(false)
    } catch {
      setBodyError(true)
    }
  }

  async function handleSend() {
    setIsLoading(true)
    setResponse(null)
    setStatusCode(null)
    const selectedKey = keys?.find((k) => k._id === selectedKeyId)
    const authToken = selectedKey ? selectedKey.publicId : token
    try {
      const opts: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      }
      if (method !== 'GET' && body.trim()) {
        opts.body = body
      }
      const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`
      const res = await fetch(url, opts)
      const status = res.status
      let data: unknown
      try {
        data = await res.json()
      } catch {
        data = null
      }
      const text = data !== null ? JSON.stringify(data, null, 2) : ''
      setStatusCode(status)
      setResponse(text)

      const entry: HistoryEntry = { method, endpoint, body, status }
      const next = [entry, ...history].slice(0, 20)
      setHistory(next)
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setResponse(msg)
      setStatusCode(0)
    } finally {
      setIsLoading(false)
    }
  }

  function handleHistoryClick(entry: HistoryEntry) {
    setMethod(entry.method)
    setEndpoint(entry.endpoint)
    setBody(entry.body)
  }

  function handleCopyCurl() {
    const selectedKey = keys?.find((k) => k._id === selectedKeyId)
    const authToken = selectedKey ? selectedKey.publicId : token
    const cmd = buildCurlCommand(method, endpoint, body, authToken)
    navigator.clipboard.writeText(cmd)
  }

  function handleCopySdk() {
    const code = buildSdkCall(method, endpoint, body)
    navigator.clipboard.writeText(code)
  }

  const docKey = `${method} ${endpoint}`
  const doc = ENDPOINT_DOCS[docKey]

  const statusColor =
    statusCode === null
      ? 'text-text-secondary'
      : statusCode >= 200 && statusCode < 300
        ? 'text-status-success'
        : 'text-status-error'

  return (
    <div data-testid="playground-panel" className="space-y-4">
      {/* Link para documentação */}
      <div className="flex justify-end">
        <a
          data-testid="link-docs"
          href="/v1/docs"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-accent-primary hover:underline"
        >
          Ver documentação
        </a>
      </div>

      {/* Barra de requisição */}
      <div className="flex gap-2 items-center">
        <select
          data-testid="method-select"
          value={method}
          onChange={(e) => setMethod(e.target.value as HttpMethod)}
          className="border border-border-default rounded px-2 py-1.5 text-sm bg-surface-card text-text-primary font-mono cursor-pointer"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <input
          data-testid="endpoint-input"
          type="text"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          placeholder={t('endpoint_placeholder')}
          className="flex-1 border border-border-default rounded px-3 py-1.5 text-sm bg-surface-card text-text-primary font-mono"
        />

        <button
          data-testid="btn-send"
          onClick={handleSend}
          disabled={isLoading}
          className="px-4 py-1.5 text-sm text-black bg-accent-primary rounded hover:bg-accent-hover disabled:opacity-60 cursor-pointer transition-colors"
        >
          {isLoading ? 'Enviando…' : 'Enviar'}
        </button>

        <button
          data-testid="btn-copy-curl"
          onClick={handleCopyCurl}
          className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded hover:bg-surface-hover cursor-pointer transition-colors"
          title={t('btn_copy_curl')}
        >
          cURL
        </button>

        <button
          data-testid="btn-copy-sdk"
          onClick={handleCopySdk}
          className="px-3 py-1.5 text-sm text-text-secondary border border-border-default rounded hover:bg-surface-hover cursor-pointer transition-colors"
          title={t('btn_copy_sdk')}
        >
          SDK
        </button>
      </div>

      {/* Seletor de API Key */}
      {keys === null ? (
        <div data-testid="apikey-loading" className="text-sm text-text-secondary animate-pulse">
          Carregando API Keys…
        </div>
      ) : keys.length === 0 ? (
        <div data-testid="apikey-empty" className="text-sm text-text-secondary">
          Nenhuma API Key ativa. Crie uma no painel Org Admin.
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-secondary">{t('label_api_key')}</label>
          <select
            data-testid="apikey-select"
            value={selectedKeyId}
            onChange={(e) => setSelectedKeyId(e.target.value)}
            className="border border-border-default rounded px-2 py-1 text-sm bg-surface-card text-text-primary font-mono cursor-pointer"
          >
            {keys.map((k) => (
              <option key={k._id} value={k._id}>
                {k.description} — {k.publicId}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Editor de body JSON */}
      {method !== 'GET' && (
        <div className="space-y-1">
          <label className="text-xs text-text-secondary">{t('label_body')}</label>
          <textarea
            data-testid="body-editor"
            value={body}
            onChange={(e) => { setBody(e.target.value); validateBody(e.target.value) }}
            rows={6}
            className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-card text-text-primary font-mono resize-y"
            placeholder={t('body_placeholder')}
          />
          {bodyError && (
            <p data-testid="body-json-error" className="text-xs text-status-error">
              JSON inválido
            </p>
          )}
        </div>
      )}

      {/* Documentação inline */}
      {doc && (
        <aside
          data-testid="docs-panel"
          className="border border-border-default rounded p-3 bg-surface-elevated space-y-1"
        >
          <p className="text-xs font-medium text-text-primary">{docKey}</p>
          <p className="text-xs text-text-secondary">{doc.description}</p>
          <dl className="text-xs space-y-1 mt-1">
            <div>
              <dt className="text-text-secondary inline">{t('label_params')} </dt>
              <dd className="inline font-mono text-text-primary">{doc.params}</dd>
            </div>
            <div>
              <dt className="text-text-secondary inline">{t('label_example')} </dt>
              <dd className="inline font-mono text-text-primary">{doc.example}</dd>
            </div>
          </dl>
        </aside>
      )}

      {/* Painel de resposta */}
      {(response !== null || isLoading) && (
        <div data-testid="response-panel" className="space-y-2">
          {statusCode !== null && (
            <span
              data-testid="response-status"
              className={`text-sm font-mono font-medium ${statusColor}`}
            >
              {statusCode === 0 ? 'Erro de rede' : `HTTP ${statusCode}`}
            </span>
          )}
          <pre
            data-testid="response-body"
            className="bg-surface-elevated border border-border-default rounded p-3 text-xs font-mono text-text-primary overflow-auto max-h-80 whitespace-pre-wrap"
          >
            {response}
          </pre>
        </div>
      )}

      {/* Histórico */}
      {history.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-text-secondary uppercase tracking-wide">{t('label_history')}</p>
          <ul data-testid="history-list" className="space-y-0.5">
            {history.map((entry, i) => (
              <li key={i}>
                <button
                  data-testid={`history-item-${i}`}
                  onClick={() => handleHistoryClick(entry)}
                  className="w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-surface-hover cursor-pointer transition-colors"
                >
                  <span className="font-mono text-accent-primary w-14 shrink-0">{entry.method}</span>
                  <span className="font-mono text-text-secondary truncate flex-1">{entry.endpoint}</span>
                  <span className={`font-mono shrink-0 ${entry.status >= 200 && entry.status < 300 ? 'text-status-success' : 'text-status-error'}`}>
                    {entry.status}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
