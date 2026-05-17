# Testes Manuais — Dashboard real-time

## Revogação de sessão em tempo real

**Pré-requisito:** dois usuários logados simultaneamente (ou duas abas com tokens diferentes).

**Passos:**

1. Abrir o dashboard em **Aba A** (painel Root → Sessions) e **Aba B** (qualquer página autenticada).
2. Identificar o `sessionId` da Aba B listado na Aba A.
3. Na Aba A, clicar em "Revogar" na sessão correspondente à Aba B.
4. Observar que a sessão desaparece da lista na Aba A **sem reload** (via WebSocket/Convex real-time).
5. Na Aba B, executar qualquer ação autenticada (navegar, chamar endpoint protegido).
6. **Resultado esperado:** a Aba B recebe `401 Unauthorized` na próxima chamada ao backend, pois o `sessionId` foi inserido na blacklist.

**Por que funciona:**
- A listagem de sessões usa `useQuery(api.sessions.listSessionsQuery)` — subscrição WebSocket que atualiza automaticamente.
- O endpoint `/v1/auth/check` (chamado internamente em cada ação) consulta a blacklist de sessões via PEP; sessões revogadas resultam em `DENY`.

## Dados em tempo real sem reload

| Recurso | Componente | Comportamento esperado |
|---|---|---|
| Usuários | `UsersListOrg` | Novo usuário criado aparece sem F5 |
| Sessões | `SessionsList` | Sessão revogada some imediatamente |
| Bindings | `BindingsList` | Binding criado/deletado reflete em tempo real |
| Audit Log | `AuditLogTable` / `AuditLogOrg` / `AuditLogWorkspace` | Evento novo aparece no topo sem reload |
