# PolyGlot Engine — Spec Técnica v3
## Plataforma pessoal de flashcards multilíngues com geração automatizada

---

## 1. VISÃO GERAL

Uma PWA pessoal que:
- Armazena e apresenta flashcards de 25 idiomas no formato Bloco25 com camada Thesaurus
- Implementa SRS (FSRS) com reviews granulares por idioma e targeting didático explícito
- Gera cards continuamente via pipeline always-on Haiku 4.5, com split por família linguística
- Permite estudo filtrado por idioma, família, tier, nível, tipo, categoria, dificuldade e alvo didático
- Expõe Telegram bot para monitoramento, alertas e guia de estudos
- Inclui TTS nativo (Web Speech API) desde a Fase 1
- Roda no EC2 ARM64 existente, conectando ao PostgreSQL já rodando na máquina
- Assume conectividade (sem offline na Fase 1); arquitetura preparada para local-first futuro

---

## 2. DECISÕES ARQUITETURAIS

### 2.1 Por que NÃO offline na Fase 1
PWA offline exige que FSRS, cards e fila de review vivam no cliente (IndexedDB/Dexie.js) com sync bidirecional ao servidor. Isso triplica a complexidade do MVP. Na prática, você estuda no celular com dados móveis — funciona. Se offline virar inegociável, a migração é para local-first com CRDT sync, mas isso é Fase 6+.

### 2.2 Por que PostgreSQL desde o dia 1
A spec tem múltiplos fluxos de escrita concorrentes: reviews do estudo, jobs de geração, import manual, aprovação de cards, marcação de dificuldade. SQLite engasga com write concurrency. Postgres já está rodando na máquina. Não há razão para não usar.

### 2.3 Por que split de geração por família
Gerar 25 idiomas × 12+ subcampos num único prompt = ~250 pontos de dado por card. Haiku degrada atenção e alucina formato em outputs longos. Quebrar por família linguística (3-5 chamadas menores) custa ~30% mais em tokens mas garante precisão gramatical e formatação limpa. Prompt caching absorve boa parte desse custo extra.

### 2.4 Por que TTS na Fase 1
Aprender idiomas tonais (ZH, VI, TH) ou com ritmo específico (JA, AR) lendo em silêncio é treinar pronúncia errada. Web Speech API é gratuita, funciona em todos os navegadores modernos, requer ~10 linhas de código, e cobre a maioria dos 25 idiomas.

---

## 3. STACK

| Camada | Tecnologia | Justificativa |
|--------|-----------|---------------|
| Frontend | Next.js 14 + Tailwind + Framer Motion | Stack preferida; PWA via next-pwa |
| Backend | Next.js API Routes + daemon process | API para UI; daemon para geração + Telegram |
| DB | PostgreSQL (existente na máquina) via Prisma | Write concurrency; já operacional |
| SRS Engine | FSRS (TypeScript port) | Melhor que SM-2; review por idioma |
| Geração | Anthropic API (Haiku 4.5 split por família + Opus gold) | Split garante qualidade; cache reduz custo |
| Validação | Zod (formato) + QA semântico (qualidade) | Duas camadas: estrutura e conteúdo |
| TTS | Web Speech API (nativa do browser) | Grátis, offline-capable, ~10 linhas |
| Telegram | grammy | Bot de monitoramento e guia |
| Infra | Docker Compose + Nginx existente + GitHub Actions | Container único na rede existente |

---

## 4. INFRA — REGRAS CRÍTICAS

### 4.1 PostgreSQL
Já está rodando na máquina. NÃO criar container de Postgres.

Setup manual único (rodar no psql do host):
```sql
CREATE USER polyglot WITH PASSWORD 'GERAR_SENHA_FORTE';
CREATE DATABASE polyglot_db OWNER polyglot;
GRANT ALL PRIVILEGES ON DATABASE polyglot_db TO polyglot;
```

Prisma aponta para:
```
DATABASE_URL="postgresql://polyglot:SENHA@host.docker.internal:5432/polyglot_db"
```

Migrations via `npx prisma migrate deploy` de dentro do container.

### 4.2 Nginx
Já está rodando em container. NÃO criar novo. NÃO reconfigurar via Compose.
Apenas adicionar location block ao conf existente:

```nginx
location /polyglot/ {
    proxy_pass http://polyglot-app:3000/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 4.3 Docker Compose
```yaml
services:
  polyglot-app:
    build: .
    container_name: polyglot-app
    restart: unless-stopped
    networks:
      - REDE_EXISTENTE       # nome real da rede Docker existente
    environment:
      - DATABASE_URL=postgresql://polyglot:SENHA@host.docker.internal:5432/polyglot_db
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}
      - GENERATION_ENABLED=true
      - GENERATION_INTERVAL_MS=120000
      - NODE_ENV=production
    extra_hosts:
      - "host.docker.internal:host-gateway"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  REDE_EXISTENTE:
    external: true
```

Trocar `REDE_EXISTENTE` pelo nome real (verificar com `docker network ls`).

---

## 5. MODELO DE DADOS (Prisma + PostgreSQL)

### 5.1 Decisões de modelagem

- **Tags normalizadas:** tabela Tag + relação N:N. Nada de string space-separated.
- **Enums reais:** PostgreSQL native enums para tipo, nivel, categoria, source, quality.
- **Thesaurus como subcampo estruturado:** cada LangBloco tem campos de sinônimos, antônimos, collocations e registro de variações.
- **Romanização explícita:** campo separado de `leitura` genérico; `romanizacao` para pinyin/romaji/etc.
- **Variação nativa:** como um local diria na rua, separado do `natural` (forma correta padrão).
- **Gramática explícita:** regra estrutural salva no bloco para evitar adivinhação.
- **Alvo didático:** cada card declara explicitamente objetivo, idioma principal, família de contraste.
- **Proteção contra duplicata:** unique constraint em frentePt normalizado.
- **Quality como enum rico:** raw → reviewed → edited → gold → deprecated → suspicious.
- **Rastreabilidade:** sourceModel, sourcePromptVersion, reviewedBy, reviewedAt.

### 5.2 Schema

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ─── ENUMS ─────────────────────────────────────────────

enum CardType {
  chunk
  padrao
  discriminacao
  cloze
}

enum Nivel {
  a1
  a2
  b1
  b2
  c1
}

enum Categoria {
  apresentacao
  polidez
  reparo_conversacional
  pedido
  direcao
  transporte
  emergencia
  trabalho
  socializacao
  comida
  hospedagem
  compras
  saude
  tempo
  numeros
  sentimentos
  opiniao
  comparacao
  descricao
  rotina
}

enum CardSource {
  haiku_auto
  haiku_manual
  opus_gold
  manual
  import_tsv
}

enum CardQuality {
  raw             // recém-gerado, nenhuma revisão humana
  reviewed        // humano olhou e aprovou sem editar
  edited          // humano editou algum campo
  gold            // exemplar; usado como few-shot
  deprecated      // obsoleto ou substituído
  suspicious      // formato ok mas conteúdo duvidoso (flagged por QA)
}

enum DifficultyLevel {
  easy
  medium
  hard
  blocked
}

enum DifficultyType {
  pronuncia
  escrita
  gramatica
  vocabulario
  interferencia
  tom            // específico para tonais
  caso           // específico para línguas com caso gramatical
  ordem          // ordem de palavras (SOV vs SVO etc.)
}

enum GenerationStatus {
  pending
  running
  validating
  done
  failed
  rejected
}

// ─── CARD ──────────────────────────────────────────────

model Card {
  id                    String       @id @default(cuid())
  seq                   Int          @unique @default(autoincrement())
  tipo                  CardType
  contexto              String       // descrição da situação
  frentePt              String       // chunk em português
  frentePtNorm          String       @unique // lowercase, trim, sem pontuação — para dedup
  notaGlobal            String       // análise translinguística

  // ─── Alvo didático ───
  objetivo              String       // ex: "treinar pedido educado com condicional"
  idiomasPrincipais     String[]     // ex: ["DE", "FR"] — foco principal deste card
  familiaContraste      String?      // ex: "germanic_vs_romance" — contraste intencional
  nivel                 Nivel
  categoria             Categoria

  // ─── Rastreabilidade ───
  source                CardSource   @default(haiku_auto)
  quality               CardQuality  @default(raw)
  sourceModel           String?      // ex: "claude-haiku-4-5-20251001"
  sourcePromptVersion   String?      // ex: "v3.1" — versão do system prompt usado
  reviewedBy            String?      // "caio" ou "auto-qa"
  reviewedAt            DateTime?

  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  blocos                LangBloco[]
  reviews               Review[]
  difficulties          LangDifficulty[]
  tags                  CardTag[]

  @@index([quality])
  @@index([categoria])
  @@index([nivel])
  @@index([source])
}

// ─── TAGS (normalizadas) ───────────────────────────────

model Tag {
  id    String    @id @default(cuid())
  name  String    @unique // lowercase, ex: "sobrevivencia", "condicional", "polidez"
  cards CardTag[]
}

model CardTag {
  cardId String
  tagId  String
  card   Card @relation(fields: [cardId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([cardId, tagId])
  @@index([tagId])
}

// ─── BLOCO DE IDIOMA ───────────────────────────────────

model LangBloco {
  id                  String @id @default(cuid())
  cardId              String
  card                Card   @relation(fields: [cardId], references: [id], onDelete: Cascade)
  langCode            String // DE, EN, FR, etc.

  // ─── Core ───
  natural             String  // frase correta padrão
  romanizacao         String  @default("—") // pinyin, romaji, transliteração (— para latinas)
  variacaoNativa      String? // como um local falaria na rua; registro coloquial real
  literal             String  // tradução palavra por palavra

  // ─── Análise ───
  padrao              String  // mecanismo gramatical principal
  gramatica           String? // regra estrutural explícita (caso, tempo, aspecto, etc.)
  obs                 String  // detalhe mais relevante desta língua para este chunk

  // ─── Armadilhas ───
  erroTipico          String  // erro mais provável de brasileiro
  contraste           String  // comparação com idioma mais perigosamente parecido
  armadilha           String  // ponto que mais causa tropeço
  padraoReutilizavel  String  // molde reaproveitável com [slots]

  // ─── Thesaurus ───
  sinonimos           String? // 2-4 formas alternativas de dizer a mesma coisa
  antonimo            String? // negação ou oposto funcional, se relevante
  collocations        String? // combinações frequentes com as palavras-chave do chunk
  campoSemantico      String? // família de palavras relacionadas (ex: pedir → pedido, garçom, conta, cardápio)
  registroVariacoes   String? // mesmo chunk em registros diferentes (formal, coloquial, gíria, arcaico)

  // ─── Meta ───
  gatilho             String  // quando usar na vida real
  registro            String  // formal, informal, neutro, polido, coloquial

  @@unique([cardId, langCode])
  @@index([langCode])
}

// ─── REVIEW (FSRS) ─────────────────────────────────────

model Review {
  id         String   @id @default(cuid())
  cardId     String
  card       Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  langCode   String?  // null = card inteiro; "DE" = idioma específico
  rating     Int      // 1=again, 2=hard, 3=good, 4=easy

  // FSRS state
  stability  Float    @default(0)
  difficulty Float    @default(0)
  due        DateTime @default(now())
  interval   Float    @default(0)
  reps       Int      @default(0)
  lapses     Int      @default(0)
  state      Int      @default(0) // 0=new, 1=learning, 2=review, 3=relearning

  reviewedAt DateTime @default(now())

  @@index([due])
  @@index([cardId, langCode])
  @@index([langCode, state])
  @@index([langCode, due])
}

// ─── DIFICULDADE POR IDIOMA ────────────────────────────

model LangDifficulty {
  id         String          @id @default(cuid())
  cardId     String
  card       Card            @relation(fields: [cardId], references: [id], onDelete: Cascade)
  langCode   String
  level      DifficultyLevel
  types      DifficultyType[] // pode ter múltiplos: ["escrita", "tom"]
  note       String?          // nota livre do usuário
  createdAt  DateTime         @default(now())
  updatedAt  DateTime         @updatedAt

  @@unique([cardId, langCode])
  @@index([langCode, level])
  @@index([level])
}

// ─── GERAÇÃO ───────────────────────────────────────────

model GenerationJob {
  id                  String           @id @default(cuid())
  chunkPt             String
  categoria           Categoria
  nivel               Nivel
  familyBatch         String?          // "romance_germanic", "cjk", "semitic_nordic", etc.
  status              GenerationStatus @default(pending)
  rawTsv              String?
  error               String?
  model               String           @default("claude-haiku-4-5-20251001")
  promptVersion       String?
  inputTokens         Int?
  outputTokens        Int?
  cachedTokens        Int?             // tokens servidos de cache
  cost                Float?
  retryCount          Int              @default(0)
  qaScore             Float?           // score de QA semântico (0-1)
  qaFlags             String[]         // ["generic_obs", "missing_romanization", etc.]
  createdAt           DateTime         @default(now())
  completedAt         DateTime?

  @@index([status])
  @@index([createdAt])
  @@index([chunkPt])
}

// ─── FILA DE CHUNKS ────────────────────────────────────

model ChunkRegistry {
  id          String    @id @default(cuid())
  chunkPt     String    @unique
  categoria   Categoria
  nivel       Nivel
  variacao    String?   // "base", "informal", "formal", "negacao", "pergunta", "extensao"
  parentChunk String?   // se é variação, aponta pro chunk original
  gerado      Boolean   @default(false)
  cardId      String?
  prioridade  Int       @default(0) // maior = gera primeiro
  createdAt   DateTime  @default(now())

  @@index([gerado, prioridade])
  @@index([categoria, nivel])
}
```

---

## 6. CAMADA THESAURUS — POR QUE E COMO

### 6.1 O problema

Flashcards tradicionais ensinam UMA forma de dizer algo. Na vida real, nativos usam dezenas de variações. "Obrigado" em francês pode ser "merci", "merci beaucoup", "je vous remercie", "c'est gentil", "merci mille fois", ou simplesmente um aceno. Sem Thesaurus, o estudante sabe uma frase e congela quando ouve outra.

### 6.2 Os 5 campos Thesaurus por idioma

**sinonimos:** 2-4 formas alternativas de dizer a mesma coisa no mesmo idioma.
Exemplo (DE, chunk "Obrigado"): "Danke schön; Vielen Dank; Herzlichen Dank; Ich danke Ihnen"

**antonimo:** negação ou oposto funcional, se relevante ao chunk.
Exemplo (DE, chunk "Eu entendi"): "Ich habe das nicht verstanden" (oposto direto: não entendi)

**collocations:** combinações frequentes com as palavras-chave do chunk.
Exemplo (DE, chunk "Eu gostaria de um café"): "Kaffee bestellen; Kaffee trinken; schwarzer Kaffee; Kaffee mit Milch; Kaffee to go"

**campoSemantico:** família de palavras relacionadas, expandindo vocabulário por associação.
Exemplo (DE, chunk "A conta, por favor"): "die Rechnung; bezahlen; das Trinkgeld; bar oder mit Karte; die Quittung; das Wechselgeld"

**registroVariacoes:** o mesmo chunk em registros diferentes.
Exemplo (DE, chunk "Eu gostaria de um café"):
- formal: "Ich hätte gerne einen Kaffee, bitte."
- coloquial: "Ich hätt gern'n Kaffee."
- muito informal: "Ein Kaffee, bitte."
- arcaico/literário: "Ich möchte einen Kaffee erbitten."

### 6.3 Como Thesaurus entra no estudo

No modo panorâmico, Thesaurus é mostrado colapsado por default — o usuário expande se quiser.
No modo foco (1 idioma), Thesaurus é mostrado aberto — é o ponto principal de ganho de vocabulário.
No modo comparativo, Thesaurus permite ver como diferentes idiomas expandem o mesmo campo semântico.

O FSRS pode criar reviews específicas de Thesaurus: "Diga 3 sinônimos de 'obrigado' em francês" — modo de produção ativa.

---

## 7. TIERS DE IMPORTÂNCIA

```typescript
export const TIER_MAP = {
  "Tier S": ["DE", "EN", "FR", "IT", "ES"],
  "Tier A": ["JA", "KO", "ZH", "RU", "AR"],
  "Tier B": ["SV", "NO", "NL", "DA", "FI"],
  "Tier C": ["BCS", "HU", "CS", "PL", "TR"],
  "Tier D": ["TH", "VI", "HE", "EL", "ID"],
} as const;

export const FAMILY_MAP = {
  germanic: ["DE", "EN", "NL", "SV", "NO", "DA"],
  romance: ["FR", "IT", "ES"],
  slavic: ["RU", "PL", "CS", "BCS"],
  cjk: ["ZH", "JA", "KO"],
  semitic: ["AR", "HE"],
  uralic: ["FI", "HU"],
  turkic: ["TR"],
  southeast_asian: ["TH", "VI", "ID"],
  hellenic: ["EL"],
} as const;

export const TIER_SRS_WEIGHT = {
  "Tier S": 1.0,
  "Tier A": 0.8,
  "Tier B": 0.5,
  "Tier C": 0.3,
  "Tier D": 0.2,
} as const;
```

---

## 8. FSRS — GRANULARIDADE E TARGETING DIDÁTICO

### 8.1 Dois modos de review

**Review geral (langCode = null):** avalia o card inteiro. Mais rápido, menos granular. Bom para modo panorâmico e revisão rápida.

**Review por idioma (langCode = "DE"):** avalia um idioma específico. Mais lento, máxima granularidade. Bom para modo foco e estudo direcionado.

Regra: no modo panorâmico, uma review geral Good (3) cria reviews implícitas New para todos os idiomas que ainda não têm review individual. Isso garante que idiomas Tier S eventualmente recebam review própria sem forçar o usuário.

### 8.2 Alvo didático no card

Cada card declara explicitamente:
- **objetivo:** o que está sendo treinado ("pedido educado com condicional de polidez")
- **idiomasPrincipais:** quais idiomas são o foco primário deste card (geralmente Tier S)
- **familiaContraste:** se o card foi criado para treinar discriminação ("germanic_vs_romance")

Isso permite filtros como:
- "só cards onde japonês é idioma principal"
- "só cards de contraste eslavo"
- "só cards cujo objetivo envolve caso gramatical"

---

## 9. QA SEMÂNTICO — VALIDAÇÃO ALÉM DO FORMATO

### 9.1 O problema

Zod valida que o TSV tem 7 campos e cada bloco tem 12 subcampos. Não valida que a tradução literal do árabe faz sentido, que a romanização do mandarim está em pinyin correto, ou que a "observação" não é uma frase genérica repetida em 15 idiomas.

### 9.2 Checklist de QA automático

Após validação Zod (formato), rodar checklist de qualidade:

```typescript
interface QAResult {
  score: number;     // 0-1
  flags: string[];   // problemas detectados
  pass: boolean;     // score > 0.7
}

function qaCheck(card: ParsedCard): QAResult {
  const flags: string[] = [];

  // 1. Contagem: exatamente 25 idiomas?
  if (card.idiomas.length !== 25) flags.push("wrong_lang_count");

  // 2. Romanização: idiomas não-latinos TÊM romanização?
  const nonLatin = ["JA", "KO", "ZH", "RU", "AR", "TH", "HE", "EL"];
  for (const code of nonLatin) {
    const bloco = card.idiomas.find(b => b.code === code);
    if (bloco && (bloco.romanizacao === "—" || !bloco.romanizacao)) {
      flags.push(`missing_romanization_${code}`);
    }
  }

  // 3. Genericidade: obs/erroTipico/contraste iguais em >3 idiomas?
  const obsValues = card.idiomas.map(b => b.obs);
  const duplicateObs = obsValues.filter((v, i) => obsValues.indexOf(v) !== i);
  if (duplicateObs.length > 3) flags.push("generic_obs");

  // 4. Literal faz sentido? (heurística: não deve ser igual ao natural)
  for (const bloco of card.idiomas) {
    if (bloco.literal === bloco.natural) flags.push(`literal_equals_natural_${bloco.code}`);
  }

  // 5. Padrão reutilizável tem [slots]?
  for (const bloco of card.idiomas) {
    if (!bloco.padraoReutilizavel.includes("[") && !bloco.padraoReutilizavel.includes("]")) {
      flags.push(`pattern_no_slots_${bloco.code}`);
    }
  }

  // 6. Thesaurus presente? (ao menos sinonimos para Tier S)
  const tierS = ["DE", "EN", "FR", "IT", "ES"];
  for (const code of tierS) {
    const bloco = card.idiomas.find(b => b.code === code);
    if (bloco && (!bloco.sinonimos || bloco.sinonimos === "—")) {
      flags.push(`missing_thesaurus_tier_s_${code}`);
    }
  }

  const score = 1 - (flags.length / 30); // normalizado; 30 = max flags possíveis
  return { score: Math.max(0, score), flags, pass: flags.length <= 5 };
}
```

### 9.3 Fluxo de qualidade

```
Haiku gera TSV
  → Zod valida formato
    → FAIL: retry 1x, depois status=failed
    → PASS: QA semântico
      → score > 0.7: quality=raw, salva no DB
      → score 0.4-0.7: quality=suspicious, salva + flag no Telegram
      → score < 0.4: status=rejected, notifica Telegram
```

Cards `suspicious` aparecem com badge amarelo no /browse e podem ser editados ou rejeitados na UI.

---

## 10. PIPELINE DE GERAÇÃO — ALWAYS ON, SPLIT POR FAMÍLIA

### 10.1 Princípio

O daemon roda CONTINUAMENTE. NÃO para até receber `/pausar` via Telegram ou `GENERATION_ENABLED=false`. Gerar e estudar são desacoplados.

### 10.2 Split por família linguística

Em vez de gerar 25 idiomas numa única chamada, o daemon quebra em batches:

```typescript
const GENERATION_BATCHES = [
  { name: "romance_germanic", langs: ["DE", "EN", "FR", "IT", "ES", "NL", "SV", "NO", "DA"] },
  { name: "cjk", langs: ["JA", "KO", "ZH"] },
  { name: "slavic_uralic", langs: ["RU", "PL", "CS", "BCS", "FI", "HU"] },
  { name: "semitic_hellenic", langs: ["AR", "HE", "EL"] },
  { name: "turkic_sea", langs: ["TR", "TH", "VI", "ID"] },
];
```

Para cada chunk:
1. Criar um GenerationJob pai
2. Enfileirar 5 sub-jobs (um por batch)
3. Cada sub-job chama Haiku com prompt focado naquela família
4. Quando todos os 5 completam, montar o card unificado
5. Rodar QA semântico no card completo
6. Persistir se passou

### 10.3 Prompt caching

System prompt (~2.5K tokens) + few-shot examples (~4K) são marcados com `cache_control: { type: "ephemeral" }`. Como o daemon faz chamadas em sequência, cache hit rate fica >90%.

Custo com cache + split:
| Cenário | Cards/dia | Custo/mês |
|---------|-----------|-----------|
| Normal | 100 | ~$8 |
| Agressivo | 200 | ~$16 |
| Máximo | 500 | ~$40 |

### 10.4 Variações anti-mesmice

Três fontes de chunks:

**Fonte 1: Fila estática (chunk-queue.json)** — editável via /generate/queue no navegador.

**Fonte 2: Variações automáticas** — quando fila esgota:
```typescript
const VARIATION_STRATEGIES = [
  { type: "registro", prompt: "Variação INFORMAL do chunk: '{chunk}'" },
  { type: "situacao", prompt: "Mesmo significado de '{chunk}' em contexto de: {ctx}" },
  { type: "negacao", prompt: "Versão NEGATIVA: '{chunk}'" },
  { type: "pergunta", prompt: "Transformar em PERGUNTA: '{chunk}'" },
  { type: "extensao", prompt: "Estender com condição ou detalhe: '{chunk}'" },
  { type: "resposta", prompt: "Resposta natural a: '{chunk}'" },
  { type: "thesaurus", prompt: "Chunk que usa SINÔNIMO da ideia central de: '{chunk}'" },
];

const CONTEXTOS = [
  "restaurante", "hospital", "aeroporto", "hotel", "delegacia",
  "farmácia", "supermercado", "transporte público", "escritório",
  "emergência médica", "ligação telefônica", "email formal",
  "conversa entre amigos", "consulta médica", "entrevista de emprego",
  "rua pedindo direção", "alfândega", "banco", "universidade",
  "festa", "academia", "cinema", "mercado de rua",
];
```

**Fonte 3: Chunks derivados de Thesaurus** — o daemon lê campos semânticos de cards existentes e gera chunks novos a partir de collocations e sinônimos que ainda não foram cobertos.

### 10.5 Dedup de conteúdo

Antes de gerar:
1. Normalizar chunk: lowercase, trim, remover pontuação
2. Checar `ChunkRegistry.chunkPt` (unique)
3. Checar `Card.frentePtNorm` (unique)
4. Se já existe, pular e pegar próximo da fila

---

## 11. TTS — WEB SPEECH API

### 11.1 Implementação no StudyCard

```typescript
// components/TtsButton.tsx
function TtsButton({ text, langCode }: { text: string; langCode: string }) {
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANG_TO_BCP47[langCode]; // "de-DE", "ja-JP", etc.
    utterance.rate = 0.85; // levemente mais devagar para estudo
    speechSynthesis.speak(utterance);
  };

  return <button onClick={speak} title="Ouvir">🔊</button>;
}

const LANG_TO_BCP47: Record<string, string> = {
  DE: "de-DE", EN: "en-GB", FR: "fr-FR", IT: "it-IT", ES: "es-ES",
  JA: "ja-JP", KO: "ko-KR", ZH: "zh-CN", RU: "ru-RU", AR: "ar-SA",
  SV: "sv-SE", NO: "nb-NO", NL: "nl-NL", DA: "da-DK", FI: "fi-FI",
  BCS: "sr-RS", HU: "hu-HU", CS: "cs-CZ", PL: "pl-PL", TR: "tr-TR",
  TH: "th-TH", VI: "vi-VN", HE: "he-IL", EL: "el-GR", ID: "id-ID",
};
```

### 11.2 Limitações conhecidas

- Qualidade varia por navegador e OS (Chrome Desktop é o melhor; Safari iOS razoável)
- Nem todos os idiomas têm vozes instaladas em todos os dispositivos
- Para idiomas sem voz local, falhar silenciosamente (botão fica cinza)
- Fase futura: substituir por API TTS paga (Google Cloud TTS, Azure) para qualidade pro

---

## 12. DIFICULDADE POR IDIOMA

### 12.1 Na interface

Ao revisar, para cada idioma visível:
- 🟢 easy — entendeu sem esforço
- 🟡 medium — entendeu com esforço
- 🔴 hard — não conseguiu
- ⬛ blocked — precisa estudo dedicado

Tipo de dificuldade (múltipla escolha):
pronúncia, escrita, gramática, vocabulário, interferência, tom, caso, ordem

### 12.2 Dashboard heatmap

```
          pronúncia  escrita  gramática  vocabulário  interferência  tom
DE  🟡         🟢       🟡          🟢            🟢          —
JA  🔴         🔴       🔴          🟡            🟢          —
ZH  🔴         🔴       🟡          🟡            🟡          🔴
AR  🔴         🔴       🟡          🟡            🟡          —
TH  🔴         🟡       🟡          🟡            🟢          🔴
```

Dashboard mostra:
- % hard/blocked por idioma e por tipo
- Evolução temporal
- Sugestão automática de sessão baseada nos gargalos

---

## 13. TELEGRAM BOT

### 13.1 Comandos

```
MONITORAMENTO:
/status          → resumo geral: total cards, quality breakdown, daemon status
/hoje            → gerados hoje, revisados, acertos, streak
/ultimo          → último card (frente + Tier S preview)
/erros           → últimos 5 jobs com erro
/custo           → custo acumulado (dia, semana, mês)

CONTROLE:
/pausar          → seta GENERATION_ENABLED=false
/retomar         → seta GENERATION_ENABLED=true
/gerar [chunk]   → gera card específico sob demanda
/aprovar [id]    → marca card como reviewed
/rejeitar [id]   → marca card como deprecated

ESTUDO:
/due             → cards vencendo por tier
/dificuldades    → top 5 gargalos (idioma × tipo)
/sugestao        → sessão ideal baseada nos dados
/tier [S|A|B|C|D] → resumo do tier
/idioma [XX]     → status detalhado de um idioma

FILA:
/fila            → próximos 10 chunks
/fila add [chunk] → adiciona chunk à fila
```

### 13.2 Notificações proativas

```
GERAÇÃO (cada card):
✅ #047 "Eu não entendi" — 25/25 OK — QA: 0.92
⚠️ #048 "Onde fica a farmácia" — QA: 0.55 (suspicious) — flags: generic_obs, missing_romanization_TH
❌ #049 "Quanto custa" — falhou — TSV malformado — retry 1/2

DIÁRIO (1x ao dia, horário configurável):
📊 Relatório 12/03/2026:
   Gerados: 47 (42 ok, 3 suspicious, 2 failed)
   Custo: $0.38
   Revisados: 15 (8 good, 4 hard, 3 again)
   Streak: 7 dias
   Tier S: 95% em dia | Tier A: 78% | Tier B: 45%
   Gargalo: JA escrita (72% hard)
   Sugestão: 15min JA+KO comparativo

ALERTAS:
🔴 Daemon parado há 2h — erro persistente
🟡 50+ cards raw não revisados
🟡 Fila de chunks < 10 restantes
🟢 Daemon retomado
```

---

## 14. INTERFACE DE ESTUDO (PWA)

### 14.1 Telas

```
/                               Dashboard (due por tier, heatmap, streak)
/study                          Sessão SRS
/study?lang=DE                  Foco idioma
/study?tier=S                   Foco tier
/study?family=germanic          Foco família
/study?cat=sobrevivencia        Foco categoria
/study?mode=compare             Comparativo (2-3 idiomas mesma família)
/study?difficulty=hard           Cards difíceis
/study?objective=condicional    Cards por objetivo didático
/browse                          Navegar cards
/browse?q=café                  Busca
/browse?quality=suspicious      Filtrar por qualidade
/card/:id                       Card completo
/card/:id/difficulty            Marcar dificuldade
/card/:id/edit                  Editar card (quality→edited)
/generate                       Daemon status + jobs recentes
/generate/queue                 Editor JSON de chunks
/generate/gold                  Gold cards manager
/stats                          Stats gerais
/stats/lang/:code               Stats por idioma
/stats/tier/:tier               Stats por tier
/stats/difficulty               Heatmap de dificuldade global
```

### 14.2 Fluxo de estudo com Thesaurus e marcação

```
1. Buscar próximos N cards due (FSRS, peso por tier)
2. Aplicar filtros
3. Para cada card:
   a. Mostrar frente (situação + chunk PT)
   b. Usuário tenta lembrar
   c. Revelar verso:
      - Natural + romanização + 🔊 TTS
      - Literal + padrão + gramática
      - Thesaurus (colapsado no panorâmico, aberto no foco)
      - Armadilha + contraste + erro típico
   d. Marcar dificuldade por idioma (🟢🟡🔴⬛ + tipo)
   e. Rating geral: Again/Hard/Good/Easy
   f. FSRS recalcula; dificuldades persistem
4. Fim: resumo (acertos, erros, dificuldades, tempo, vocab novo via Thesaurus)
```

---

## 15. ESTRUTURA DO PROJETO

```
polyglot-engine/
├── prisma/
│   └── schema.prisma                       # PostgreSQL
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # Dashboard
│   │   ├── study/page.tsx
│   │   ├── browse/page.tsx
│   │   ├── card/[id]/page.tsx
│   │   ├── card/[id]/difficulty/page.tsx
│   │   ├── card/[id]/edit/page.tsx
│   │   ├── generate/page.tsx
│   │   ├── generate/queue/page.tsx
│   │   ├── generate/gold/page.tsx
│   │   ├── stats/page.tsx
│   │   ├── stats/lang/[code]/page.tsx
│   │   ├── stats/tier/[tier]/page.tsx
│   │   ├── stats/difficulty/page.tsx
│   │   └── api/
│   │       ├── cards/route.ts
│   │       ├── cards/[id]/route.ts
│   │       ├── cards/[id]/difficulty/route.ts
│   │       ├── cards/[id]/edit/route.ts
│   │       ├── study/due/route.ts
│   │       ├── study/review/route.ts
│   │       ├── generate/route.ts
│   │       ├── generate/status/route.ts
│   │       ├── generate/toggle/route.ts
│   │       ├── generate/queue/route.ts
│   │       ├── tags/route.ts
│   │       ├── stats/route.ts
│   │       ├── stats/difficulty/route.ts
│   │       └── health/route.ts
│   ├── daemon/
│   │   ├── index.ts                        # Entry: inicia gerador + Telegram
│   │   ├── generator.ts                    # Loop always-on + split por família
│   │   ├── assembler.ts                    # Monta card unificado dos sub-jobs
│   │   ├── qa.ts                           # QA semântico
│   │   ├── telegram.ts                     # Bot
│   │   ├── notifier.ts                     # Notificações proativas
│   │   └── study-advisor.ts                # Lógica do /sugestao
│   ├── lib/
│   │   ├── fsrs.ts                         # Algoritmo FSRS
│   │   ├── parser.ts                       # TSV parser + Zod
│   │   ├── generator.ts                    # Chamada Haiku + cache
│   │   ├── queue.ts                        # Fila + variações + dedup
│   │   ├── tiers.ts                        # Tiers + famílias
│   │   ├── difficulty.ts                   # Lógica de dificuldade
│   │   ├── thesaurus.ts                    # Lógica de Thesaurus no estudo
│   │   ├── tts.ts                          # Web Speech API helpers
│   │   ├── normalize.ts                    # Normalização de texto para dedup
│   │   └── db.ts                           # Prisma client
│   ├── components/
│   │   ├── StudyCard.tsx
│   │   ├── LangBlock.tsx
│   │   ├── ThesaurusPanel.tsx
│   │   ├── TtsButton.tsx
│   │   ├── RatingButtons.tsx
│   │   ├── DifficultyMarker.tsx
│   │   ├── FilterBar.tsx
│   │   ├── TierDashboard.tsx
│   │   ├── DifficultyHeatmap.tsx
│   │   ├── ChunkQueueEditor.tsx
│   │   ├── GenerationStatus.tsx
│   │   ├── QualityBadge.tsx
│   │   └── StatsCharts.tsx
│   └── data/
│       ├── gold-cards.json
│       ├── chunk-queue.json
│       └── system-prompt.txt
├── scripts/
│   ├── seed-gold.ts
│   ├── import-tsv.ts
│   └── migrate.ts
├── public/
│   ├── manifest.json
│   └── sw.js
├── Dockerfile
├── docker-compose.yml                      # SÓ app; sem DB; sem Nginx
├── .env.example
└── .github/workflows/deploy.yml
```

---

## 16. ROADMAP

### Fase 1 — Core + TTS (2 semanas)
- [ ] Prisma schema + PostgreSQL setup (user, DB, migrations)
- [ ] Parser TSV + validação Zod
- [ ] QA semântico básico
- [ ] FSRS engine com review por idioma
- [ ] Tiers + famílias + alvo didático
- [ ] API routes (CRUD cards, study/due, study/review, tags)
- [ ] Tela de estudo modo panorâmico com TTS (Web Speech API)
- [ ] Marcação de dificuldade por idioma
- [ ] Dedup por frentePtNorm
- [ ] Docker + deploy (container único, rede existente, PG existente)

### Fase 2 — Geração always-on (semana 3)
- [ ] Gerar 10-20 gold cards com Opus 4.6 (incluindo Thesaurus)
- [ ] Daemon always-on com split por família
- [ ] Prompt caching
- [ ] Fila de chunks + variações automáticas
- [ ] Assembler de sub-jobs
- [ ] QA semântico completo
- [ ] Editor de chunks via UI

### Fase 3 — Telegram bot (semana 3-4)
- [ ] Bot básico: /status, /hoje, /ultimo, /erros, /custo
- [ ] Notificações proativas (geração + diário)
- [ ] /pausar, /retomar, /gerar [chunk]
- [ ] /sugestao com study-advisor
- [ ] /aprovar, /rejeitar
- [ ] /fila add [chunk]

### Fase 4 — Thesaurus + Polish (semana 4-5)
- [ ] Campos Thesaurus no LangBlock (sinonimos, antonimo, collocations, campoSemantico, registroVariacoes)
- [ ] ThesaurusPanel no estudo (colapsável)
- [ ] Modo foco com Thesaurus aberto
- [ ] Dashboard heatmap de dificuldade
- [ ] PWA (manifest + service worker)
- [ ] Modo comparativo e modo por objetivo didático
- [ ] Stats por idioma, tier e dificuldade
- [ ] Tela de edição de card com quality governance

### Fase 5 — Evolução
- [ ] TTS premium (Google Cloud TTS / Azure) para idiomas sem voz nativa
- [ ] Cards de discriminação gerados automaticamente a partir de interferências detectadas
- [ ] Modo desafio (produção livre sem opções)
- [ ] Revisão rápida via Telegram (inline keyboard)
- [ ] Integração com agente Telegram existente
- [ ] Export para Anki (backup)
- [ ] Local-first offline (IndexedDB + CRDT sync) — se necessidade se confirmar
