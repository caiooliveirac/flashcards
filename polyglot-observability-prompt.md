# PolyGlot Engine — Upgrade: Observabilidade + Controle de Fila

## Contexto

O PolyGlot Engine já está rodando em produção (EC2 ARM64, Docker, Nginx, PostgreSQL).
O daemon gera cards continuamente com split por 5 famílias linguísticas via Haiku.
Já existem: página /generate básica, bot Telegram básico, schema Prisma completo.

O problema: a interface de monitoramento é rasa (só mostra ✅, data e QA score genérico) e não há controle da fila de chunks sem SSH. Preciso de observabilidade profunda e controle total da fila via Telegram e frontend.

---

## PARTE 1 — API Routes de observabilidade e controle

Criar ou expandir estas rotas. Todas retornam JSON. O bot Telegram e o frontend consomem as mesmas rotas.

### 1.1 GET /api/generate/status

Retorna estado completo do daemon e métricas agregadas:

```typescript
{
  daemon: {
    enabled: boolean,
    uptime_seconds: number,
    interval_ms: number,
    current_state: "idle" | "generating" | "paused",
    last_tick_at: string | null,        // ISO timestamp
    next_tick_at: string | null,
  },
  queue: {
    total_chunks: number,               // total no chunk-queue
    pending: number,                    // não gerados ainda
    generated: number,
    failed: number,
    variations_available: number,       // variações automáticas possíveis
  },
  generation: {
    today: {
      total: number,
      success: number,
      suspicious: number,
      failed: number,
      avg_qa_score: number,
      total_cost_usd: number,
      total_input_tokens: number,
      total_output_tokens: number,
      total_cached_tokens: number,
    },
    all_time: {
      total_cards: number,
      by_quality: { raw: number, reviewed: number, edited: number, gold: number, deprecated: number, suspicious: number },
      total_cost_usd: number,
    },
  },
  last_5_jobs: GenerationJobDetail[],   // ver estrutura abaixo
}
```

### 1.2 GET /api/generate/jobs?limit=20&status=done|failed|suspicious

Lista jobs com detalhes completos:

```typescript
interface GenerationJobDetail {
  id: string;
  chunkPt: string;
  status: string;
  quality: string | null;               // quality do card gerado, se existir
  createdAt: string;
  completedAt: string | null;
  duration_ms: number | null;
  // Detalhes por família
  batches: {
    family: string;                     // "romance_germanic", "cjk", etc.
    status: "ok" | "error" | "pending";
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    cost_usd: number;
    duration_ms: number;
    langs_generated: string[];          // ["DE", "EN", "FR", ...]
    error: string | null;
  }[];
  // QA
  qa: {
    score: number;
    passed: boolean;
    flags: string[];                    // ["generic_obs", "missing_romanization_TH", ...]
    checks: {
      name: string;
      passed: boolean;
      detail: string;
    }[];
  } | null;
  // Card gerado
  card_id: string | null;
  card_seq: number | null;
}
```

### 1.3 GET /api/generate/jobs/:id

Job individual com tudo — incluindo o TSV bruto e o card parseado.

### 1.4 GET /api/queue

Retorna a fila completa:

```typescript
{
  static_queue: {
    total: number,
    pending: ChunkEntry[],
    generated: ChunkEntry[],
  },
  variation_queue: {
    available: number,
    next_10: ChunkEntry[],
  },
}

interface ChunkEntry {
  id: string;
  chunkPt: string;
  categoria: string;
  nivel: string;
  variacao: string | null;
  parentChunk: string | null;
  prioridade: number;
  gerado: boolean;
  cardId: string | null;
}
```

### 1.5 POST /api/queue/add

Adiciona chunk(s) à fila. Aceita um ou vários:

```typescript
// Body
{
  chunks: {
    chunkPt: string;
    categoria: string;        // enum Categoria
    nivel: string;            // enum Nivel
    prioridade?: number;      // default 0; maior = gera primeiro
  }[]
}
// Response
{
  added: number,
  duplicates: number,         // chunks que já existiam
  entries: ChunkEntry[],
}
```

### 1.6 POST /api/queue/bulk

Aceita JSON completo para substituir ou merge na fila:

```typescript
// Body
{
  mode: "merge" | "replace",  // merge = adiciona sem duplicar; replace = limpa e recria
  chunks: { chunkPt: string; categoria: string; nivel: string; prioridade?: number; }[]
}
```

### 1.7 DELETE /api/queue/:id

Remove chunk da fila.

### 1.8 PATCH /api/queue/:id

Edita chunk (prioridade, categoria, nível).

### 1.9 POST /api/queue/reorder

Reordena por prioridade:

```typescript
// Body
{ ids: string[] }  // nova ordem; o primeiro recebe prioridade mais alta
```

### 1.10 GET /api/cards/browse?page=1&limit=20&q=&quality=&categoria=&nivel=&tier=&lang=&sort=newest

Browse completo de cards com filtros e paginação. Retorna cards com preview (frente, tipo, quality, qa_score, data, tags, idiomas principais).

### 1.11 GET /api/cards/:id

Card completo com todos os LangBlocos, thesaurus, dificuldades, reviews.

### 1.12 GET /api/stats/overview

Stats para dashboard:

```typescript
{
  total_cards: number,
  by_quality: Record<string, number>,
  by_categoria: Record<string, number>,
  by_nivel: Record<string, number>,
  by_tier: Record<string, { total: number, due: number, reviewed_today: number }>,
  generation: { today: number, week: number, month: number, cost_month: number },
  study: { reviewed_today: number, streak: number, due_now: number },
  difficulty_heatmap: { langCode: string, type: string, count: number, pct_hard: number }[],
}
```

---

## PARTE 2 — Bot Telegram expandido

Usar grammy. O bot consome as mesmas rotas /api/* via fetch interno (localhost).

### 2.1 Comandos de observabilidade

```
/status
→ Consome GET /api/generate/status
→ Formata como:

🟢 Daemon Ativo | Intervalo: 120s
⏱ Uptime: 4h 23min | Próximo tick: 12s

📊 Hoje:
  ✅ 47 gerados (42 ok, 3 ⚠️, 2 ❌)
  💰 $0.38 | 🎯 QA médio: 0.89
  📥 184K in | 📤 329K out | 💾 156K cache

📦 Fila: 12 pendentes | 18 gerados | 847 variações disponíveis

🏆 Total: 523 cards (489 raw, 22 reviewed, 8 gold, 4 suspicious)

/ultimo
→ Consome GET /api/generate/jobs?limit=1&status=done
→ Mostra card completo:

✅ #047 "Eu não entendi, pode repetir?"
📅 13/03 09:23 | ⏱ 14.2s | 💰 $0.008
🎯 QA: 0.92

Batches:
  romance_germanic: ✅ 1.8K in/2.4K out (cache: 1.6K) — 2.1s
  cjk: ✅ 1.9K in/2.8K out (cache: 1.7K) — 3.4s
  slavic_uralic: ✅ 1.8K in/2.6K out (cache: 1.6K) — 2.8s
  semitic_hellenic: ✅ 1.7K in/1.9K out (cache: 1.5K) — 2.0s
  turkic_sea: ✅ 1.8K in/2.1K out (cache: 1.6K) — 1.9s

QA Checks:
  ✅ 25/25 idiomas
  ✅ romanização presente (8/8 não-latinos)
  ✅ observações não genéricas
  ✅ literais distintos de naturais
  ✅ padrões com [slots]
  ⚠️ thesaurus Tier S: 4/5 preenchidos (falta IT)
  ✅ dedup ok

Preview Tier S:
  🇩🇪 Ich habe das nicht verstanden, können Sie das bitte wiederholen?
  🇬🇧 I didn't understand, could you please repeat that?
  🇫🇷 Je n'ai pas compris, pourriez-vous répéter s'il vous plaît ?

/erros
→ Consome GET /api/generate/jobs?limit=5&status=failed
→ Lista com detalhes do erro por batch

/erros [id]
→ Consome GET /api/generate/jobs/:id
→ Mostra detalhes completos incluindo erro exato e TSV bruto truncado

/custo
→ Consome GET /api/generate/status
→ Formata:

💰 Custos:
  Hoje: $0.38 (47 cards)
  Semana: $2.14 (267 cards)
  Mês: $8.42 (1,053 cards)

  Média: $0.008/card
  Cache hit: 87%
  Projeção mensal: ~$12.60

/qa
→ Consome GET /api/generate/jobs?limit=50
→ Agrupa flags de QA mais frequentes:

📋 QA últimos 50 cards:
  Score médio: 0.88
  ✅ 42 passed | ⚠️ 6 suspicious | ❌ 2 rejected

  Flags mais comuns:
  • missing_thesaurus_tier_s (8x) — IT e ES mais afetados
  • generic_obs (3x) — NO e DA repetindo "idioma nórdico similar"
  • pattern_no_slots (2x) — TH e VI

/card [seq]
→ Consome GET /api/cards/:id (busca por seq)
→ Mostra card completo formatado com todos os idiomas Tier S + resumo dos demais
```

### 2.2 Comandos de controle de fila

```
/fila
→ Consome GET /api/queue
→ Mostra:

📋 Fila de chunks:
  Pendentes: 12 | Gerados: 18 | Variações: 847

  Próximos 10:
  1. [P5] "Pode me ajudar?" (a1, sobrevivencia)
  2. [P3] "Eu sou médico" (a1, apresentacao)
  3. [P2] "Quanto custa isso?" — variação: pergunta (a1, compras)
  ...

/fila add [chunk]
→ POST /api/queue/add com categoria e nível inferidos pelo bot (ou defaults a1, sobrevivencia)
→ Confirma:

✅ Adicionado: "Onde fica a farmácia mais próxima?"
  Categoria: direcao | Nível: a1 | Prioridade: 0

/fila add -c pedido -n a2 -p 5 [chunk]
→ Mesmo mas com flags explícitas:
  -c = categoria
  -n = nível
  -p = prioridade

/fila bulk
→ Bot responde: "Envie um JSON com array de chunks. Formato:"
→ Usuário envia JSON inline ou arquivo .json
→ Bot faz POST /api/queue/bulk mode=merge

/fila remover [id ou número na lista]
→ DELETE /api/queue/:id

/fila priorizar [id] [prioridade]
→ PATCH /api/queue/:id

/fila limpar gerados
→ Remove da exibição chunks já gerados (não deleta do banco, só filtra)

/gerar [chunk]
→ Adiciona chunk com prioridade 999 (gera no próximo tick)
→ Confirma: "⏳ Chunk enfileirado com prioridade máxima. Será gerado no próximo tick (~2min)."
→ Quando gerado, envia notificação normal
```

### 2.3 Notificações proativas melhoradas

Cada card gerado envia mensagem mais rica:

```
SUCESSO:
✅ #047 "Eu não entendi, pode repetir?"
⏱ 14.2s | 💰 $0.008 | 🎯 QA: 0.92
📊 5/5 batches OK | 25/25 langs
📦 Fila: 11 pendentes

SUSPICIOUS:
⚠️ #048 "Onde fica a farmácia?"
⏱ 18.7s | 💰 $0.009 | 🎯 QA: 0.58
📊 5/5 batches OK | 25/25 langs
⛳ Flags: generic_obs (DA, NO), missing_thesaurus (ES)
→ Revisar em: /polyglot/card/048/edit

ERRO:
❌ #049 "Quanto custa o quarto?"
⏱ 8.3s | Batch falhou: cjk
🔴 Erro: API timeout after 30s
🔄 Retry 1/2 agendado

RELATÓRIO DIÁRIO (configurável, ex: 22h):
📊 Relatório 13/03/2026

Geração:
  ✅ 47 cards (42 ok, 3 ⚠️, 2 ❌)
  💰 $0.38 | Cache: 87%
  🎯 QA médio: 0.89
  ⏱ Tempo médio: 14s/card

Fila:
  📦 12 pendentes → ~24min para esgotar
  🔄 847 variações automáticas prontas

Qualidade:
  Flags mais comuns: missing_thesaurus_tier_s (8x), generic_obs (3x)
  Idiomas mais problemáticos na geração: TH, VI (QA mais baixo)

Estudo:
  📖 15 cards revisados (8 good, 4 hard, 3 again)
  🔥 Streak: 7 dias
  📊 Tier S: 95% em dia | Tier A: 78%
```

---

## PARTE 3 — Frontend /generate redesenhado

Redesenhar completamente a página /generate. Usar o dark theme existente do projeto.

### 3.1 Layout da página

```
/generate
├── Header: "⚙ Geração" com badge de status do daemon
├── Seção 1: Status do daemon (card expandido)
│   ├── Status: 🟢 Ativo / 🔴 Pausado / 🟡 Gerando...
│   ├── Uptime, intervalo, próximo tick (countdown live)
│   ├── Botão Pausar/Retomar
│   └── Métricas rápidas: cards hoje, custo, QA médio, cache hit %
├── Seção 2: Adicionar chunks
│   ├── Input único (chunk + categoria + nível + prioridade)
│   ├── Botão "Gerar agora" (prioridade 999)
│   ├── Textarea para bulk JSON
│   └── Toggle: "Enviar vários de uma vez"
├── Seção 3: Fila de chunks
│   ├── Tabs: Pendentes | Gerados | Variações
│   ├── Lista ordenada por prioridade
│   ├── Cada item: chunk, categoria, nível, prioridade, ações (editar, deletar, subir, descer)
│   ├── Drag-and-drop para reordenar
│   └── Filtros: por categoria, por nível
├── Seção 4: Jobs recentes
│   ├── Lista paginada (20 por página)
│   ├── Cada job: status icon, chunk, data, duração, custo, QA score
│   ├── Expandir job → detalhes por batch (tokens, tempo, langs, erros)
│   ├── Expandir job → QA checks detalhados (cada check com ✅/⚠️/❌)
│   ├── Expandir job → preview Tier S (natural dos 5 idiomas principais)
│   ├── Filtros: status (ok, suspicious, failed), data range
│   └── Link para card gerado (/card/:id)
└── Seção 5: Custos e métricas
    ├── Gráfico: cards gerados por dia (últimos 30 dias)
    ├── Gráfico: custo por dia
    ├── Gráfico: QA score médio por dia
    ├── Tabela: tokens in/out/cache por família
    └── Projeção de custo mensal
```

### 3.2 Componentes específicos

**DaemonStatusCard:** Polling a cada 5s em GET /api/generate/status. Countdown animado até próximo tick. Badge pulsante verde/vermelho.

**ChunkInput:** Formulário com:
- Input de texto para o chunk
- Select de categoria (enum do Prisma)
- Select de nível (a1, a2, b1, b2)
- Input numérico de prioridade
- Botão "Adicionar à fila" (prioridade normal)
- Botão "Gerar agora" (prioridade 999, cor de destaque)

**BulkChunkEditor:** Textarea com JSON schema hint. Botão "Validar" (roda Zod client-side). Botão "Enviar" (POST /api/queue/bulk mode=merge). Preview do que será adicionado antes de confirmar.

**QueueList:** Lista com drag-and-drop (usar @dnd-kit/core ou similar leve). Cada item mostra chunk, badges de categoria/nível, prioridade editável inline. Ações: editar, deletar, mover para topo.

**JobCard (expandível):** Estado colapsado mostra 1 linha. Expandido mostra:
- 5 barras de progresso (uma por batch) com tokens e tempo
- QA checklist com ícones por check
- Preview dos 5 idiomas Tier S
- Link "Ver card completo"
- Link "Editar card" se suspicious
- Botão "Regenerar" se failed

**CostChart:** Recharts LineChart com custos diários. Tooltip com breakdown por família.

### 3.3 Melhorias no /browse

A página /browse precisa permitir encontrar qualquer card para revisar na hora:

- Busca full-text no frentePt
- Filtros: quality, categoria, nível, tier, tag, idioma com dificuldade hard
- Ordenação: mais recente, mais antigo, pior QA, mais difícil
- Cada card na lista mostra: seq, frente, quality badge, QA score, tags, data
- Clicar abre o card completo com todos os idiomas expandíveis
- Botão "Estudar este card agora" → abre /study?card=:id
- Botão "Marcar como gold" / "Deprecar" / "Editar"

---

## PARTE 4 — Modelo de dados para suportar observabilidade

### 4.1 Expandir GenerationJob

Se o schema atual não tiver campos por batch, adicionar:

```prisma
model GenerationBatch {
  id              String   @id @default(cuid())
  jobId           String
  job             GenerationJob @relation(fields: [jobId], references: [id], onDelete: Cascade)
  family          String   // "romance_germanic", "cjk", etc.
  status          String   // "ok", "error", "pending"
  inputTokens     Int      @default(0)
  outputTokens    Int      @default(0)
  cachedTokens    Int      @default(0)
  costUsd         Float    @default(0)
  durationMs      Int      @default(0)
  langsGenerated  String[] // ["DE", "EN", "FR", ...]
  rawResponse     String?  // resposta bruta da API (para debug)
  error           String?
  createdAt       DateTime @default(now())

  @@index([jobId])
}
```

Adicionar relation em GenerationJob:
```prisma
model GenerationJob {
  // ... campos existentes ...
  batches         GenerationBatch[]
  durationMs      Int?
}
```

### 4.2 Expandir QA

Se qaFlags é string[], migrar para modelo separado ou manter como array Postgres mas adicionar qaChecks como JSON:

```prisma
model GenerationJob {
  // ... campos existentes ...
  qaChecks        Json?    // { checks: [{ name: string, passed: boolean, detail: string }] }
}
```

---

## PARTE 5 — Daemon: logging estruturado

O daemon deve logar de forma estruturada para que os dados fluam para as rotas:

```typescript
// Cada geração deve persistir TODOS os dados por batch no GenerationBatch
// O daemon já faz as chamadas split — agora precisa registrar:

for (const batch of GENERATION_BATCHES) {
  const start = Date.now();
  try {
    const result = await callHaiku(chunk, batch);
    await db.generationBatch.create({
      data: {
        jobId: job.id,
        family: batch.name,
        status: "ok",
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        cachedTokens: result.usage.cache_read_input_tokens || 0,
        costUsd: calculateCost(result.usage),
        durationMs: Date.now() - start,
        langsGenerated: batch.langs,
        rawResponse: result.content[0]?.text?.substring(0, 5000), // truncar para não explodir o DB
      }
    });
  } catch (err) {
    await db.generationBatch.create({
      data: {
        jobId: job.id,
        family: batch.name,
        status: "error",
        durationMs: Date.now() - start,
        error: err.message,
        langsGenerated: [],
      }
    });
  }
}
```

---

## Regras de implementação

1. Todas as rotas /api/* devem funcionar independentemente (o frontend e o Telegram consomem as mesmas rotas).
2. O bot Telegram faz fetch para http://localhost:3000/api/* (internal) — não expor rotas de controle publicamente sem auth.
3. Usar Zod para validar bodies dos POSTs.
4. Pagination padrão: page + limit com defaults (page=1, limit=20).
5. Manter dark theme consistente com o que já existe.
6. Componentes React com Tailwind, sem CSS separado.
7. Gráficos com recharts (já está nas deps do projeto conforme spec).
8. Drag-and-drop com lib leve; se não disponível, usar botões de mover para cima/baixo como fallback.
9. Mobile-first: a interface /generate deve funcionar bem no celular.
10. Todas as ações destrutivas (delete chunk, deprecar card, replace queue) pedem confirmação.

## Sequência de implementação sugerida

1. Migration Prisma: adicionar GenerationBatch + expandir GenerationJob
2. API routes de observabilidade (/api/generate/status, /api/generate/jobs, etc.)
3. API routes de controle de fila (/api/queue/*)
4. Expandir API /api/cards/browse com filtros completos
5. Atualizar daemon para persistir GenerationBatch a cada chamada
6. Redesenhar frontend /generate com todas as seções
7. Melhorar frontend /browse com filtros e busca
8. Expandir bot Telegram com todos os comandos
9. Notificações proativas melhoradas no Telegram
10. Testes manuais end-to-end

Comece pela migration e pelas rotas. O frontend e o Telegram são consumidores — as rotas são a fundação.
