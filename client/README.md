# Cliente - Gambiarra LLM Club Arena

CLI para conectar participantes ao servidor e rodar LLMs locais.

## Instalação

```bash
pnpm install
pnpm build
```

## Uso

### Cliente com Ollama

```bash
pnpm dev -- \
  --url ws://localhost:3000/ws \
  --pin 123456 \
  --participant-id meu-pc \
  --nickname "Meu Nome" \
  --runner ollama \
  --model llama3.1:8b
```

### Cliente com LM Studio

```bash
pnpm dev -- \
  --url ws://localhost:3000/ws \
  --pin 123456 \
  --participant-id laptop-xyz \
  --nickname "João" \
  --runner lmstudio \
  --model mistral-7b \
  --lmstudio-url http://localhost:1234
```

### Cliente Simulado (Mock)

```bash
pnpm dev -- \
  --url ws://localhost:3000/ws \
  --pin 123456 \
  --participant-id simulador \
  --nickname "Bot Teste" \
  --runner mock
```

## Opções CLI

```
--url <url>              WebSocket server URL (default: ws://localhost:3000/ws)
--pin <pin>              Session PIN (required)
--participant-id <id>    Unique participant ID (required)
--nickname <name>        Display name (required)
--runner <type>          Runner: ollama, lmstudio, mock (default: ollama)
--model <model>          Model name (default: llama3.1:8b)
--temperature <temp>     Temperature (default: 0.8)
--max-tokens <tokens>    Max tokens (default: 400)
--ollama-url <url>       Ollama API URL (default: http://localhost:11434)
--lmstudio-url <url>     LM Studio API URL (default: http://localhost:1234)
```

## Runners

### Ollama

Certifique-se de que o Ollama está rodando:

```bash
# Verificar
curl http://localhost:11434/api/tags

# Iniciar (se necessário)
ollama serve

# Baixar modelo
ollama pull llama3.1:8b
```

### LM Studio

1. Abra LM Studio
2. Carregue um modelo
3. Vá em "Local Server" → "Start Server"
4. Porta padrão: 1234

### Mock

Gera tokens sintéticos sem necessidade de LLM real. Útil para:
- Testes
- Desenvolvimento
- Ensaios sem hardware

## Simulação em Massa

Para testar com múltiplos clientes:

```bash
# Inicia 5 clientes simulados
pnpm simulate

# Customizar
SERVER_URL=ws://192.168.1.100:3000/ws PIN=999999 pnpm simulate
```

## Funcionamento

1. Cliente conecta ao WebSocket do servidor
2. Envia mensagem `register` com PIN
3. Aguarda mensagem `challenge` do servidor
4. Executa runner local (Ollama/LM Studio/Mock)
5. Streaming de tokens via mensagens `token` com seq incremental
6. Envia `complete` com métricas ao final

## Reconexão

O cliente tenta reconectar automaticamente com backoff exponencial:
- Máximo 5 tentativas
- Delay inicial: 1s
- Delay máximo: ~32s

## Exemplo de Output

```
🎮 Gambiarra LLM Club Client

Using Ollama at http://localhost:11434
✓ Runner connection OK

✓ Connected to server

📢 New Challenge - Round 1
Prompt: Escreva uma poesia sobre IA
Max tokens: 400, Deadline: 90000ms

.................................................................................
.................................................................................

✓ Completed 312 tokens in 54.23s
  First token latency: 850ms
```

## Desenvolvimento

Estrutura:

```
src/
├── cli.ts          # Entry point CLI
├── net/
│   └── ws.ts       # WebSocket client
├── runners/
│   ├── types.ts    # Interface Runner
│   ├── ollama.ts   # Integração Ollama
│   ├── lmstudio.ts # Integração LM Studio
│   └── mock.ts     # Gerador simulado
└── scripts/
    └── simulate.ts # Simulação em massa
```

## Troubleshooting

**Erro "Runner not available":**
- Verifique se Ollama/LM Studio está rodando
- Confirme a porta correta

**Erro "Invalid PIN":**
- Solicite o PIN ao organizador do evento
- Use `curl -X POST http://SERVER:3000/session` se você é o organizador

**Tokens não aparecem no telão:**
- Verifique conectividade de rede
- Confirme que a rodada foi iniciada no servidor
- Use `--runner mock` para descartar problemas com LLM local
