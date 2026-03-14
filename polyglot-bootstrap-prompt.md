# PolyGlot Engine — Bootstrap Prompt para Claude Code / Opus

## Contexto

Você vai atuar como engenheiro principal do projeto **PolyGlot Engine** e implementar a base completa do sistema.

A spec de referência está em `polyglot-spec-v3.md` dentro deste repositório. Se o arquivo não existir nesse path, procure o markdown mais recente que contenha "PolyGlot Engine — Spec Técnica v3" no workspace e use esse como contrato principal. Confirme qual arquivo escolheu antes de prosseguir.

---

## Regras de ouro — não violar sob nenhuma circunstância

1. **Spec é contrato.** Onde a spec for explícita, siga. Onde houver lacuna, escolha a solução mais simples compatível com a spec e registre a decisão em `docs/decisions.md`.
2. **Conflito spec vs. prompt de geração:** O schema Prisma (relacional, campos tipados, enums) é a fonte de verdade para persistência. O formato TSV com `|` e `||` é formato de transporte/importação. O `parser.ts` faz a ponte entre os dois. Nunca achate o modelo relacional para caber no TSV — o parser é que deve expandir o TSV para o modelo.
3. **Postgres existente.** NÃO criar container de Postgres. Conectar via `DATABASE_URL` ao Postgres do host.
4. **Nginx existente.** NÃO criar container de Nginx. O app se integra à rede Docker existente.
5. **Sem offline na Fase 1.** Sem IndexedDB, sem Dexie, sem service worker funcional. PWA manifest sim, offline não.
6. **Sem simplificações "porque é mais simples".** Se a spec pede enums nativos, use enums. Se pede tags N:N, normalize. Se pede 25 idiomas com 17 subcampos cada, implemente os 17.
7. **TypeScript estrito.** `strict: true` no tsconfig. Sem `any` exceto em boundaries de API externas com cast explícito.
8. **Deploy em subpath.** Produção roda em `/polyglot/`. Dev roda na raiz `/`. Usar `NEXT_PUBLIC_BASE_PATH` para controlar.

---

## Stack com versões pinadas

```
next@14.2.x
react@18.x
typescript@5.4.x
tailwindcss@3.4.x
framer-motion@11.x
prisma@5.x / @prisma/client@5.x
zod@3.23.x
grammy@1.x (Telegram bot)
concurrently@8.x (dev scripts)
tsx@4.x (rodar daemon em dev)
```

Não instalar nada fora dessa lista sem justificativa documentada em `docs/decisions.md`.

---

## Sequência de implementação

Execute nesta ordem exata. A cada fase concluída, liste os arquivos criados/alterados e o que falta.

### Fase 0 — Leitura e resumo (NÃO editar arquivos ainda)

1. Ler `docs/polyglot-spec-v3.md` inteiro.
2. Produzir resumo técnico de no máximo 20 linhas cobrindo:
   - Stack confirmada
   - Decisões arquiteturais críticas
   - Estrutura de pastas (da spec seção 15)
   - Modelo de dados principal (Card → LangBloco → Review → LangDifficulty → Tag)
   - Conflitos ou lacunas detectados
3. Propor ordem de execução detalhada.
4. Só depois de eu confirmar (ou se estiver em modo autônomo: depois de registrar o resumo), começar a editar.

### Fase 1 — Scaffold do projeto

Criar a estrutura base:

```
polyglot-engine/
├── docs/
│   ├── polyglot-spec-v3.md          # já deve existir
│   └── decisions.md                  # criar — log de decisões
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── study/page.tsx
│   │   └── api/health/route.ts
│   ├── daemon/
│   │   └── index.ts
│   ├── lib/
│   │   ├── db.ts
│   │   ├── fsrs.ts
│   │   ├── parser.ts
│   │   ├── tiers.ts
│   │   ├── normalize.ts
│   │   └── types.ts                  # tipos centrais derivados do schema
│   └── components/
│       └── .gitkeep
├── scripts/
│   └── .gitkeep
├── public/
│   └── manifest.json
├── package.json
├── tsconfig.json
├── next.config.mjs
├── tailwind.config.ts
├── postcss.config.js
├── .env.example
├── .gitignore
├── Dockerfile
└── docker-compose.yml
```

Arquivos obrigatórios nesta fase:
- `package.json` com todas as dependências pinadas e scripts:
  - `dev` → Next.js dev
  - `dev:daemon` → tsx watch src/daemon/index.ts
  - `dev:all` → concurrently dev + dev:daemon
  - `build` → next build
  - `start` → next start
  - `db:migrate` → prisma migrate deploy
  - `db:generate` → prisma generate
  - `db:push` → prisma db push
  - `db:studio` → prisma studio
- `tsconfig.json` com strict: true, paths aliases (@/ → src/)
- `next.config.mjs` com basePath condicional
- `tailwind.config.ts` com content apontando para src/
- `.env.example` com todas as vars da spec:
  ```
  DATABASE_URL="postgresql://polyglot:SENHA@host.docker.internal:5432/polyglot_db"
  ANTHROPIC_API_KEY=""
  TELEGRAM_BOT_TOKEN=""
  TELEGRAM_CHAT_ID=""
  GENERATION_ENABLED=true
  GENERATION_INTERVAL_MS=120000
  NEXT_PUBLIC_BASE_PATH=""
  ```

### Fase 2 — Schema Prisma completo

Implementar TODO o schema da spec v3 seção 5, incluindo:
- Todos os enums PostgreSQL nativos (CardType, Nivel, Categoria, CardSource, CardQuality, DifficultyLevel, DifficultyType, GenerationStatus)
- Card com campos de alvo didático (objetivo, idiomasPrincipais, familiaContraste)
- Card com frentePtNorm @unique para dedup
- Card com rastreabilidade (sourceModel, sourcePromptVersion, reviewedBy, reviewedAt)
- LangBloco com TODOS os 17 campos (natural, romanizacao, variacaoNativa, literal, padrao, gramatica, obs, erroTipico, contraste, armadilha, padraoReutilizavel, sinonimos, antonimo, collocations, campoSemantico, registroVariacoes, gatilho, registro)
- Review com campos FSRS completos
- LangDifficulty com types como array Postgres
- Tag + CardTag N:N
- GenerationJob com campos de custo e QA
- ChunkRegistry com dedup e prioridade

Depois de criar o schema:
- Rodar `npx prisma generate` para confirmar que compila
- NÃO rodar migrate ainda (Postgres pode não estar acessível no ambiente de dev)

### Fase 3 — Lib core

- `src/lib/db.ts` — singleton Prisma client
- `src/lib/types.ts` — tipos TypeScript derivados dos enums Prisma + constantes
- `src/lib/tiers.ts` — TIER_MAP, FAMILY_MAP, TIER_SRS_WEIGHT, getTier(), getFamily() exatamente como na spec
- `src/lib/normalize.ts` — normalizeFrentePt() para dedup (lowercase, trim, remover pontuação)
- `src/lib/fsrs.ts` — implementação FSRS-5 completa com:
  - interface FSRSState (stability, difficulty, due, interval, reps, lapses, state)
  - schedule(state, rating, now, params?) → FSRSState
  - getDueCards(reviews[], now) → sorted by due
  - DEFAULT_PARAMS com os 19 pesos padrão
- `src/lib/parser.ts` — parseTSV(raw: string) → ParsedCard com validação Zod:
  - Validar 7 campos TSV (split por \t)
  - Validar Bloco25 (split por ||, exatamente 25)
  - Validar cada bloco (split por |, extrair key=value)
  - Retornar tipo tipado ou throw com detalhes do erro

### Fase 4 — Rotas e páginas mínimas

- `src/app/api/health/route.ts` — GET retorna { status: "ok", timestamp, db: "connected"|"disconnected" }
- `src/app/layout.tsx` — layout base com Tailwind, sem floreios
- `src/app/page.tsx` — dashboard placeholder com link para /study
- `src/app/study/page.tsx` — tela de estudo placeholder que:
  - Mostra um card mock hardcoded (para validar layout)
  - Ou lê do banco se Prisma estiver conectado
  - Botão de TTS usando Web Speech API (mesmo com card mock)

### Fase 5 — Daemon skeleton

- `src/daemon/index.ts` — entry point que:
  - Loga "[DAEMON] PolyGlot generation daemon started"
  - Lê GENERATION_ENABLED do env
  - Entra em loop com GENERATION_INTERVAL_MS
  - Em cada tick: loga "[DAEMON] Tick — would generate card here"
  - Trata SIGINT/SIGTERM para shutdown graceful
  - NÃO implementa geração real ainda (isso é Fase 2 do roadmap da spec)

### Fase 6 — Docker + docs

- `Dockerfile` — multi-stage build (deps → build → runtime)
  - Base: node:20-slim
  - Instala openssl (necessário para Prisma)
  - Copia prisma/ e gera client
  - Build Next.js
  - Runtime: roda next start + daemon via script de entrypoint
- `docker-compose.yml` — APENAS o app, conforme spec seção 4.3
  - Referencia rede externa
  - Usa host.docker.internal para Postgres
  - Variáveis de ambiente via .env
- `docs/decisions.md` — registrar:
  - Versões exatas instaladas
  - Decisões tomadas em lacunas da spec
  - Conflitos encontrados e como foram resolvidos

---

## Checklist de qualidade — conferir antes de reportar conclusão

- [ ] `npm install` funciona sem erros
- [ ] `npx prisma generate` compila o schema sem erros
- [ ] `npm run dev` sobe o Next.js e `/` carrega
- [ ] `npm run dev:daemon` inicia o daemon e loga ticks
- [ ] `npm run dev:all` roda ambos simultaneamente
- [ ] `/api/health` retorna JSON com status ok
- [ ] `/study` renderiza (mesmo com card mock)
- [ ] TypeScript compila sem erros (`npx tsc --noEmit`)
- [ ] Schema Prisma reflete 100% da spec v3 seção 5
- [ ] Nenhum container de Postgres ou Nginx foi criado
- [ ] `docs/decisions.md` existe e documenta decisões

---

## Como reportar progresso

A cada fase concluída, entregue:
1. Lista de arquivos criados/alterados
2. Qualquer decisão tomada em lacuna da spec
3. Qualquer conflito encontrado
4. O que falta para a próxima fase

Se algo ficar grande demais para um passo, continue sem pedir confirmação. O objetivo é ter o projeto rodando ao final, não parar no meio.

Comece pela Fase 0: leia a spec e me entregue o resumo técnico.
