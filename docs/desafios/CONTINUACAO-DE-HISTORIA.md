# Cânone Comunitário — Continuação de História

Modo narrativo colaborativo da Gambiarra Arena. A cada **capítulo**, todos os
LLMs conectados recebem o **mesmo cânone acumulado**, escrevem uma continuação e
são avaliados pela plateia. A continuação vencedora é **anexada automaticamente**
à história e vira a base do próximo capítulo. No fim, a arena tem uma obra
escrita a várias mãos (várias GPUs, na real).

> Guia único: explica **como a feature funciona** e traz o **passo a passo para
> rodar ao vivo** com várias máquinas.

## Índice

- [Telas](#telas)
- [Como funciona](#como-funciona)
  - [Ciclo de um capítulo (estados)](#ciclo-de-um-capítulo-estados)
  - [Como o vencedor é escolhido](#como-o-vencedor-é-escolhido)
  - [Voto cego](#voto-cego)
  - [O prompt e o cânone acumulado](#o-prompt-e-o-cânone-acumulado)
  - [Limites de configuração](#limites-de-configuração)
- [Guia ao vivo (passo a passo)](#guia-ao-vivo-passo-a-passo)
- [Controles do apresentador](#controles-do-apresentador)
- [Recuperação e casos especiais](#recuperação-e-casos-especiais)
- [Solução de problemas](#solução-de-problemas)
- [Dados e exportação](#dados-e-exportação)
- [Referência da API](#referência-da-api)

---

## Telas

Todas servidas pelo telão (porta `5173`), exceto o cliente do participante
(servido pelo servidor na `3000`, mas também acessível via proxy na `5173`).

| Rota | Quem usa | Para quê |
|---|---|---|
| `/story-control` | Apresentador | Criar a história e conduzir todas as fases |
| `/story` | Projetor / telão | Cânone, geração ao vivo, candidatos e obra final |
| `/story-voting` | Celulares da plateia | Nota de 0 a 5 para cada continuação |
| `/client` | Máquina de cada participante | Conectar o LLM local (Ollama, LM Studio, llama.cpp) |

---

## Como funciona

### Ciclo de um capítulo (estados)

Cada história tem um `status` e um contador `currentChapter` (0 → total). Cada
capítulo é, internamente, uma **rodada** normal da arena — por isso streaming de
tokens, métricas, votos e exportação já funcionam de graça.

```
                 ┌──────────────────────────────────────────────┐
                 ▼                                              │
  [ready] ──"Iniciar capítulo"──► [generating] ──"Encerrar geração"──► [voting]
     ▲                                                                    │
     │                                                 "Tornar vencedor cânone"
     │                                                                    │
     └──────────────── (ainda há capítulos) ◄───────────────────────────┤
                                                                          │
                                          (era o último capítulo) ──► [completed]
```

- **ready** — pronto para iniciar o próximo capítulo (ou o primeiro).
- **generating** — o desafio foi transmitido; os modelos escrevem ao vivo.
- **voting** — geração encerrada; a plateia vota nas continuações.
- **completed** — o último capítulo foi canonizado; a obra está fechada.

Ao **canonizar** um capítulo, o texto vencedor é concatenado ao `canonText` e:
se ainda houver capítulos, volta para **ready**; se era o último, vai para
**completed**.

### Como o vencedor é escolhido

Quando você clica em **Tornar vencedor cânone (por votos)**, o servidor ordena os
candidatos por:

1. **maior média** de votos;
2. desempate: **mais votos**;
3. depois: **mais notas 5**;
4. por fim: um **id estável** (resultado reproduzível).

Além disso, para nunca travar um evento ao vivo:

- **Escolha manual** — o apresentador pode cravar um vencedor específico
  (resolve empates ou decide quando a plateia não votou). A escolha manual
  **prevalece** sobre os votos.
- **Sem nenhum voto** — o botão "por votos" ainda funciona: cai num critério
  determinístico (primeiro por id estável), então a história sempre avança.

### Voto cego

Para o voto não ser enviesado por quem escreveu:

- Durante **generating** e **voting**, o telão (`/story`) mostra só
  *"Continuação 1, 2, 3…"* — **sem o nome do autor**.
- O autor só é revelado **depois de canonizar** (estados `ready`/`completed`) e
  na tela da obra final.
- A numeração das continuações é a **mesma** no telão e nos celulares (ordenação
  por id estável), então "Continuação 2" é sempre o mesmo texto nas duas telas.

**Rubrica sugerida** (nota única de 0 a 5): coerência narrativa **40%**,
criatividade e originalidade **35%**, estilo e humor **25%**.

### O prompt e o cânone acumulado

Cada capítulo recebe um prompt montado pelo servidor com **todo o cânone até
ali** mais instruções (produza 180–260 palavras, deixe um gancho; no capítulo
final, resolva o conflito e termine com uma frase memorável).

Em histórias longas o cânone é **cortado de forma inteligente** para não
estourar o contexto de modelos pequenos: mantém a **abertura** e os **capítulos
mais recentes** e resume o miolo com um marcador. Ou seja, coerência de começo e
de fim são preservadas.

### Limites de configuração

Validados no servidor ao criar a história:

| Campo | Faixa |
|---|---|
| Título | 3 a 120 caracteres |
| Ponto de partida (seed) | 40 a 12.000 caracteres |
| Capítulos | 1 a 10 |
| Tokens por resposta | 100 a 2.000 |
| Temperatura | 0 a 2 |
| Tempo (deadline) | 30 a 600 segundos |

> ⏱️ **O "Tempo (s)" é uma dica enviada ao cliente, não um corte automático.**
> O servidor **não** encerra a geração sozinho quando o tempo acaba — o
> apresentador clica em **Encerrar geração** quando as respostas chegam.

---

## Guia ao vivo (passo a passo)

Cenário: uma **máquina host** (roda servidor + telão + telas do apresentador) e
uma ou mais **máquinas participantes** (cada uma com seu LLM local).

### 0. Pré-requisitos

- Host: Node 20+, pnpm, dependências instaladas (`pnpm install`) e banco
  migrado (`pnpm --filter @gambiarra/server db:migrate`).
- Cada participante: um **LLM local** rodando — **Ollama**, **LM Studio** ou
  **llama.cpp** (o cliente do navegador não tem modo "mock"). No Ollama, tenha
  um modelo baixado, ex.: `ollama pull llama3.1:8b`.

### 1. Liberar o firewall no host (uma vez)

No **PowerShell como Administrador**:

```bash
netsh advfirewall firewall add rule name="Gambiarra 3000" dir=in action=allow protocol=TCP localport=3000
```
```bash
netsh advfirewall firewall add rule name="Gambiarra 5173" dir=in action=allow protocol=TCP localport=5173
```

### 2. Subir servidor + telão (host)

```bash
pnpm dev
```

Sobe o servidor em `:3000` e o telão em `:5173`. (O `.env` do servidor é
carregado automaticamente.)

### 3. Descobrir o IP do host na rede

```bash
ipconfig
```

Anote o **IPv4** da sua rede (ex.: `192.168.1.10`). Vamos chamar de `<IP>`.

### 4. Abrir as telas do apresentador **pelo IP**

> ⚠️ Abra pelo `<IP>`, **não** por `localhost` — o QR Code entregue aos
> participantes é gerado a partir do endereço que você usa aqui.

| Tela | URL |
|---|---|
| Controle | `http://<IP>:5173/story-control` |
| Telão (projetor) | `http://<IP>:5173/story` |
| Votação (plateia) | `http://<IP>:5173/story-voting` |

No **/story-control**:

1. **"Criar sessão primeiro"** (se ainda não houver sessão) → anote o **PIN** no
   card lateral (com QR Code).
2. Preencha título, ponto de partida, nº de capítulos, tokens e tempo.
3. **"Criar competição"**.

### 5. Conectar os participantes

Cada participante, com o LLM rodando, abre no navegador:

```
http://<IP>:3000/client
```

Preenche **PIN** + **Apelido**, escolhe o **Provedor** (Ollama/LM Studio),
clica **"Testar LLM"** e depois **"Entrar na arena"**. O apelido aparece no card
"Participantes" do `/story-control`.

> Para virar competição de verdade, conecte **2+ agentes** (várias máquinas, ou
> abas com **modelos diferentes** na mesma máquina).

### 6. Conduzir a história

Para cada capítulo, no `/story-control`:

1. **Iniciar capítulo N** → acompanhe a escrita ao vivo no `/story` (autores
   ocultos).
2. Quando as respostas chegarem → **Encerrar geração e abrir votação**.
3. A plateia vota em `/story-voting` (0–5 por continuação).
4. **Tornar vencedor cânone (por votos)** — ou, se ninguém votou / há empate,
   use **Escolher manualmente**.
5. Repita até o capítulo final. No fim, o `/story` exibe a obra completa com os
   autores revelados por capítulo.

### 7. Nova rodada (sem trocar o PIN)

Com a história **concluída**, clique em **Nova história (mesma sessão)**: abre o
formulário de criação **sem apagar** a história anterior e **sem** trocar o PIN —
os participantes continuam conectados. Crie outra premissa e rode de novo.

---

## Controles do apresentador

Botões que aparecem no `/story-control` conforme o estado:

| Estado | Botões disponíveis |
|---|---|
| `ready` | **Iniciar capítulo N** · Descartar história |
| `generating` | **Encerrar geração e abrir votação** · Cancelar capítulo |
| `voting` | **Tornar vencedor (por votos)** · Escolher manualmente · Cancelar capítulo |
| `completed` | ✅ mensagem de conclusão · **Nova história (mesma sessão)** |

Ações destrutivas usam **confirmação de dois cliques** (Confirmar / Não) — não
dependem de caixas de diálogo do navegador.

- **Cancelar capítulo** (em `generating`/`voting`): descarta as continuações e
  votos **só do capítulo atual** e volta a história para o capítulo anterior. O
  cânone já consolidado **não** é afetado. Use quando um capítulo travar (ninguém
  gerou, modelo caiu).
- **Descartar história** (em `ready`, história **não** finalizada): apaga a
  história inteira e volta para a criação. Serve para abandonar uma premissa em
  andamento — o servidor bloqueia criar outra enquanto existe uma inacabada.
- **Nova história (mesma sessão)** (em `completed`): **não apaga nada**; só abre
  o formulário para começar outra rodada reusando sessão, PIN e participantes.

---

## Recuperação e casos especiais

- **Capítulo sem nenhuma resposta** → "Encerrar geração" recusa (não há o que
  votar). Use **Cancelar capítulo** para voltar e reiniciar.
- **Plateia não votou** → "Tornar vencedor (por votos)" ainda funciona (critério
  determinístico) ou use **Escolher manualmente**.
- **Empate** → o desempate é automático (votos → notas 5 → id), ou decida com
  **Escolher manualmente**.
- **Participante caiu no meio** → o cliente do navegador reconecta sozinho
  (backoff). Quem conecta **depois** do capítulo começar só entra no próximo.
- **Reiniciar o servidor** derruba os WebSockets; os clientes reconectam, mas
  evite salvar arquivos no host durante um evento (o `pnpm dev` reinicia ao
  salvar — para eventos grandes, prefira um build sem watch).

---

## Solução de problemas

| Sintoma | Causa / solução |
|---|---|
| Participante não abre `/client` | Firewall ou IP errado. Teste `http://<IP>:3000/health` no navegador dele. |
| "Failed to fetch" / lista de modelos vazia no `/client` | CORS do LLM local. O botão **⟳** mostra o comando certo. Ollama no Windows: `$env:OLLAMA_ORIGINS="*"; ollama serve`. Digitar o nome do modelo à mão também funciona. |
| QR Code aponta para `localhost` | Você abriu o `/story-control` por `localhost`. Reabra pelo `<IP>`. |
| Modelo pequeno demora / gera pouco | Normal; aumente "Tokens" ou o "Tempo", ou use um modelo maior. |
| Porta 3000/5173 ocupada | Feche instâncias antigas do servidor/telão e suba de novo. |

---

## Dados e exportação

Tudo é persistido no SQLite e entra nos exports da sessão:

- `http://<IP>:3000/export-all.json` — sessão completa (participantes, rodadas,
  métricas, votos, **histórias e capítulos**, eventos).
- `http://<IP>:3000/export.csv` — métricas por participante/rodada.
- `http://<IP>:3000/export-events.csv` — trilha de eventos (inclui
  `story_created`, `story_chapter_started`, `story_voting_opened`,
  `story_chapter_canonized`, `story_chapter_cancelled`, `story_discarded`,
  `story_completed`).

O servidor também grava **snapshots** periódicos em disco. **Descartar história**
apaga os dados dela do banco — se quiser guardar uma história concluída, exporte
antes.

---

## Referência da API

Todas as rotas de história (o `/story-control` as consome via proxy `/api`):

| Método | Rota | Corpo | Faz |
|---|---|---|---|
| GET | `/story/state` | — | Estado da história mais recente da sessão ativa (ou `null`). |
| POST | `/story` | `{ title, seedText, totalChapters, maxTokens?, temperature?, deadlineMs? }` | Cria uma história (bloqueado se já houver uma **não** concluída). |
| POST | `/story/:id/chapters/start` | — | Inicia o próximo capítulo (transmite o desafio). |
| POST | `/story/:id/chapters/stop` | — | Encerra a geração e abre a votação. |
| POST | `/story/:id/chapters/cancel` | — | Cancela o capítulo atual e volta ao anterior. |
| POST | `/story/:id/canonize` | `{ participantId? }` | Consagra o vencedor (por votos, ou o `participantId` informado). |
| POST | `/story/:id/discard` | — | Apaga a história inteira. |

Erros voltam como `400` com `{ "error": "mensagem em pt-BR" }`.
