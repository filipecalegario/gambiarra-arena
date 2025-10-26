# Servidor - Gambiarra LLM Club Arena

Backend Fastify com WebSocket para orquestração de rodadas e streaming de tokens.

## Arquitetura

```
src/
├── ws/           # WebSocket Hub e schemas Zod
│   ├── hub.ts    # Gerenciamento de conexões e broadcast
│   └── schemas.ts # Validação de mensagens
├── http/         # APIs REST
│   └── routes.ts # Rotas HTTP (sessões, rodadas, votos)
├── core/         # Lógica de negócio
│   ├── rounds.ts # Gerenciamento de rodadas
│   ├── votes.ts  # Sistema de votação
│   └── metrics.ts # Agregação e exportação
├── db/
│   └── prisma/   # Schema e migrações
└── index.ts      # Entry point
```

## Comandos

```bash
# Desenvolvimento
pnpm dev            # Inicia servidor com hot reload
pnpm build          # Build TypeScript
pnpm start          # Produção

# Database
pnpm db:migrate     # Roda migrações Prisma
pnpm db:generate    # Gera Prisma Client
pnpm db:studio      # Abre Prisma Studio
pnpm seed           # Popula DB com dados de teste

# Testes
pnpm test           # Roda testes
pnpm test:coverage  # Com cobertura
```

## Variáveis de Ambiente

Copie `.env.example` para `.env` e ajuste:

```bash
PORT=3000
HOST=0.0.0.0
DATABASE_URL="file:./dev.db"
CORS_ORIGIN=*
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW=60000
WS_COMPRESSION=false
WS_MAX_PAYLOAD=1048576
```

## Endpoints HTTP

### Público

- `GET /health` - Health check
- `GET /session` - Sessão ativa (sem PIN)
- `GET /rounds/current` - Rodada atual com tokens ao vivo
- `GET /scoreboard` - Placar da rodada atual
- `GET /metrics` - Métricas da sessão
- `GET /export.csv` - Exporta resultados em CSV

### Organização

- `POST /session` - Cria nova sessão e retorna PIN
- `POST /rounds` - Cria rodada
- `POST /rounds/start` - Inicia rodada (envia challenge aos clientes)
- `POST /rounds/stop` - Encerra rodada
- `POST /votes` - Registra voto
- `POST /participants/kick` - Remove participante

## WebSocket

Endpoint: `ws://localhost:3000/ws`

### Mensagens Server → Client

**Challenge:**
```json
{
  "type": "challenge",
  "session_id": "sess-123",
  "round": 1,
  "prompt": "...",
  "max_tokens": 400,
  "temperature": 0.8,
  "deadline_ms": 90000
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat",
  "ts": 1730000000
}
```

### Mensagens Client → Server

**Register:**
```json
{
  "type": "register",
  "participant_id": "ana-desktop",
  "nickname": "Ana",
  "pin": "123456",
  "runner": "ollama",
  "model": "llama3.1:8b"
}
```

**Token:**
```json
{
  "type": "token",
  "round": 1,
  "participant_id": "ana-desktop",
  "seq": 42,
  "content": "texto"
}
```

**Complete:**
```json
{
  "type": "complete",
  "round": 1,
  "participant_id": "ana-desktop",
  "tokens": 312,
  "latency_ms_first_token": 850,
  "duration_ms": 54000,
  "model_info": {
    "name": "Llama 3.1 8B Q4",
    "runner": "Ollama"
  }
}
```

## Banco de Dados

Schema Prisma com 5 entidades:

- **Session**: Sessões com PIN hash
- **Participant**: Participantes cadastrados
- **Round**: Rodadas com prompts e configurações
- **Metrics**: Métricas de geração por participante/rodada
- **Vote**: Votos do público

### Migrações

```bash
# Criar migração
pnpm db:migrate

# Reset database
rm -f prisma/dev.db && pnpm db:migrate
```

## Publicando o Telão

O frontend React é servido via proxy do Vite em dev, mas em produção:

1. Build do telão: `cd ../telao && pnpm build`
2. Sirva com nginx ou configure `@fastify/static`

## mDNS (Opcional)

Para hostname amigável na LAN (ex: `llm-arena.local`):

```bash
# macOS/Linux
brew install avahi

# Configure MDNS_HOSTNAME no .env
```

## Logs

Logs estruturados em JSON com Pino:

```bash
# Desenvolvimento (pretty print)
pnpm dev

# Produção (JSON)
NODE_ENV=production pnpm start
```

## Rate Limiting

Configurado por padrão:
- 100 requisições por minuto por IP
- Ajuste via `RATE_LIMIT_MAX` e `RATE_LIMIT_TIME_WINDOW`

## CORS

Em produção, restrinja CORS:

```bash
CORS_ORIGIN=http://localhost:5173,http://llm-arena.local
```
