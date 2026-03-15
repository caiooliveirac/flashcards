# Grammar & Vocabulary Course Architecture
## From Flashcard Insight → Deep Learning Module

---

## 1. The Core Philosophy

### The Problem with Grammar Teaching

Most language apps fall into two traps:

**Trap A — The Textbook Dump**: Presents grammar tables (conjugation charts, case tables, particle lists) and expects the learner to memorize them in isolation. The learner reads, thinks "ok," and forgets within a day. This is what Duolingo tips do, what most grammar appendices do, and what 90% of AI-generated content defaults to.

**Trap B — The Kindergarten Approach**: Assumes the learner is cognitively simple. Uses patronizing language ("Great job! You learned the dative!"), avoids linguistic terminology, never explains *why* a rule exists. Treats adults like children learning their first language.

### Our Approach: The "Colleague Explanation"

Imagine you're a doctor doing a rotation in Germany. A German colleague notices you made a case error and, during a coffee break, explains the rule — not from a textbook, but from the perspective of someone who *understands* how language works and respects your intelligence.

That colleague would:
- Use the proper term ("dative case") without apologizing for it
- Immediately connect it to something you already know ("In Portuguese, you'd say 'para mim' — that 'mim' IS a dative form, you just don't think of it that way")
- Give you the **one rule** that covers 80% of real usage, not the 47 exceptions
- Tell you what mistake they see Brazilians make most often and *why* the brain makes that mistake
- Give you a physical/spatial metaphor that makes the abstract rule feel concrete

This is what every grammar module should feel like.

---

## 2. Information Architecture

### The Flow: Card → Grammar Module

```
FLASHCARD (card view)
  │
  ├── User sees: grammar field with a clickable grammar tag
  │   e.g., "Dativ nach Wechselpräpositionen" (clickable)
  │
  └── TAP → Opens GRAMMAR MODULE for that topic in that language
      │
      ├── Section 1: The Insight (what this rule IS)
      ├── Section 2: The Mechanism (how it works, with pattern)
      ├── Section 3: The Trap (what your brain wants to do wrong)
      ├── Section 4: The Anchor (memorable connection to PT-BR)
      ├── Section 5: Practice (contextual micro-exercises)
      └── Section 6: Related Cards (other flashcards using this rule)
```

### Grammar Topic Taxonomy

Each language has grammar organized NOT by traditional textbook order (articles → nouns → verbs) but by **functional clusters** — groups of grammar that work together in real speech:

```
LANGUAGE: German (DE)
│
├── 🧭 Navigation Grammar
│   ├── Wechselpräpositionen (two-way prepositions: Akkusativ vs Dativ)
│   ├── Richtung vs Ort (direction vs location patterns)
│   └── Lokale Adverbien (hin/her, dahin/dorthin)
│
├── 🗣️ Opinion Grammar  
│   ├── Konjunktiv II (subjunctive for hypotheticals & politeness)
│   ├── Modalpartikeln (doch, mal, ja, halt — the soul of German)
│   └── Nebensatz mit "dass/ob/weil" (subordinate clause word order)
│
├── ⏳ Time Grammar
│   ├── Perfekt vs Präteritum (when to use which past)
│   ├── Temporale Präpositionen (seit/vor/in/ab/bis)
│   └── Futur I vs Präsens für Zukunft (future tense choice)
│
├── 🤝 Social Grammar
│   ├── Du/Sie register system
│   ├── Konjunktiv II für Höflichkeit (würde, könnte, hätte)
│   └── Indirekte Rede (reported speech with Konjunktiv I)
│
├── 🔧 Structure Grammar
│   ├── V2-Regel (verb-second in main clauses)
│   ├── Satzklammer (sentence bracket with separable verbs)
│   ├── Kasus-System (Nom/Akk/Dat/Gen with triggers)
│   └── Relativsätze (relative clauses and pronoun selection)
│
└── 🎯 Precision Grammar
    ├── Adjektivdeklination (adjective endings by case/gender/article)
    ├── Präpositionalergänzungen (verb + preposition combos)
    └── Genus-Regeln (noun gender patterns and heuristics)
```

The same functional clustering applies to EVERY language, but the specific topics differ:

- **Japanese**: Particle grammar (は vs が), Honorific grammar (keigo levels), Connector grammar (から/ので/ため), Counter grammar
- **Arabic**: Root-pattern grammar, Case grammar, Verb form grammar (Forms I-X), Definite/indefinite grammar
- **Turkish**: Vowel harmony grammar, Agglutination grammar, Evidentiality grammar (-miş vs -di)
- **French**: Subjunctive trigger grammar, Clitic placement grammar, Partitive grammar

### The Grammar Module ID System

Each grammar topic gets a unique ID that the flashcard system can reference:

```
{language_code}_{cluster}_{topic}_{subtopic}

Examples:
DE_STRUCT_KASUS_DATIV        → German > Structure > Case System > Dative
JA_PARTICLE_WA_GA            → Japanese > Particles > は vs が
FR_SOCIAL_SUBJONCTIF_TRIGGER → French > Social > Subjunctive > Triggers
AR_MORPH_ROOT_PATTERN_I      → Arabic > Morphology > Root-Pattern > Form I
TR_STRUCT_VOWEL_HARMONY      → Turkish > Structure > Vowel Harmony
```

---

## 3. The Grammar Module: Section by Section

### Section 1: The Insight (2-3 paragraphs)

**Purpose**: Answer "what IS this rule and why does it exist?"

**Tone**: Conversational but precise. Like a TED talk, not a lecture.

**Template for AI generation**:
```
Explain {grammar_topic} in {language} as if you're a polyglot colleague 
talking to a Brazilian Portuguese speaker during a coffee break. 

Rules:
- Use the proper linguistic term, then immediately demystify it
- Start with WHY the rule exists (what problem it solves in communication)
- Connect to a PT-BR equivalent or near-equivalent in the first paragraph
- Never say "it's simple" or "it's complicated" — just explain it
- Use exactly ONE physical/spatial metaphor to make it concrete
- Maximum 3 paragraphs, each 2-4 sentences
- Write in PT-BR
```

**Example output** (for DE_STRUCT_KASUS_DATIV):

> O dativo em alemão marca quem *recebe* a ação — não quem a sofre, mas quem é o destinatário, o beneficiário, o ponto de chegada emocional. Pense assim: se o acusativo é a bola que você chuta, o dativo é o goleiro — a pessoa pra quem a bola vai. Em português, você já usa essa lógica toda vez que diz "dei o livro *pra ela*" ou "isso é importante *pra mim*": esse "pra mim/pra ela" É dativo, só que o português esconde isso dentro de preposições enquanto o alemão marca diretamente no artigo e no pronome.
>
> Na prática, o dativo aparece em três situações que cobrem 80% do uso real: (1) depois de verbos de transferência como *geben*, *zeigen*, *schicken* — "eu dou algo A ALGUÉM"; (2) depois de certas preposições que sempre pedem dativo — *mit*, *nach*, *aus*, *bei*, *seit*, *von*, *zu* (o famoso mnemônico MNAbSVZ); (3) depois de Wechselpräpositionen quando a ideia é localização estática, não movimento. Essa terceira é onde todo mundo erra, e a gente vai tratar ela em módulo próprio.
>
> O ponto que faz o dativo "clicar" na cabeça: ele sempre responde à pergunta *wem?* (a quem?). Se você consegue reformular a frase em português com "a quem" ou "para quem" e faz sentido, é dativo. "Eu mostrei o mapa *a quem*? Ao turista." → Ich zeigte dem Touristen die Karte. O *dem* é o sinal de dativo masculino — o artigo mudou de *der* para *dem*, e é isso que seus olhos precisam aprender a pegar automaticamente.

### Section 2: The Mechanism (Pattern Display)

**Purpose**: Show the rule as a visual, scannable pattern — not a paragraph.

**Format**: A clean, interactive pattern card:

```
┌─────────────────────────────────────────────────┐
│  DATIVO: Quem recebe a ação                     │
│                                                  │
│  Masculino:  der → dem    ein → einem            │
│  Feminino:   die → der    eine → einer           │
│  Neutro:     das → dem    ein → einem            │
│  Plural:     die → den (+n no substantivo)       │
│                                                  │
│  ⚡ Gatilho rápido:                              │
│  "Se é pra alguém, com alguém, ou de alguém     │
│   → muda o artigo pro dativo"                    │
│                                                  │
│  🔑 Preposições que SEMPRE pedem dativo:         │
│  mit · nach · aus · bei · seit · von · zu        │
│  (mnemônico: "MiNa AuBei SeiVoZu")              │
└─────────────────────────────────────────────────┘
```

**For non-table languages**, the mechanism adapts:

**Japanese (は vs が)**:
```
┌─────────────────────────────────────────────────┐
│  は (wa) vs が (ga): Topic vs Subject            │
│                                                  │
│  は marca: "Falando de X..."                     │
│     → 私は医者です (Falando de mim... sou médico)│
│     (watashi wa isha desu)                       │
│                                                  │
│  が marca: "É X que..." (foco novo/contraste)    │
│     → 誰が来た？私が来た。                        │
│     (dare ga kita? watashi ga kita.)             │
│     (Quem veio? EU que vim.)                     │
│                                                  │
│  ⚡ Teste rápido:                                │
│  Se você pode substituir por "QUANTO a X" → は   │
│  Se você pode substituir por "É X que" → が      │
└─────────────────────────────────────────────────┘
```

### Section 3: The Trap (Error Analysis)

**Purpose**: Explain the specific L1 interference that causes Brazilian learners to err.

**Format**: A "brain X-ray" — showing what the brain WANTS to do vs what it SHOULD do.

```
🧠 O que o cérebro brasileiro faz:

  PT: "Eu moro NA cidade"
       ↓ traduz direto ↓
  DE: "Ich wohne in die Stadt" ← ❌ ERRADO (acusativo)
  
  Por quê? Em português, "na" não distingue se você 
  está SE MOVENDO para lá ou já ESTÁ lá. A preposição 
  "em" é estática por padrão. O cérebro assume que a 
  tradução direta funciona.

🎯 O que deveria fazer:

  "Eu moro NA cidade" (localização estática, sem movimento)
       ↓ localização = dativo ↓
  DE: "Ich wohne in der Stadt" ← ✅ CORRETO (dativo)
  
  vs.
  
  "Eu vou PRA cidade" (direção, movimento para)
       ↓ direção = acusativo ↓
  DE: "Ich gehe in die Stadt" ← ✅ CORRETO (acusativo)

💡 Macete: Pergunta "tem deslocamento físico?" 
   SIM → acusativo (wohin?) 
   NÃO → dativo (wo?)
```

### Section 4: The Anchor (Cross-linguistic Connection)

**Purpose**: A memorable bridge between PT-BR and the target language. Not comparison tables — a genuine insight that makes the rule "stick."

**Format**: 1-2 paragraphs, narrative style.

```
A melhor analogia que existe para Wechselpräpositionen 
é algo que o português faz com os verbos "ir" e "estar":

  "Eu vou NO cinema" (movimento → acusativo em alemão)
  "Eu estou NO cinema" (localização → dativo em alemão)

Em português, a preposição "no" é idêntica nos dois casos. 
Seu cérebro nunca precisou distinguir isso. Em alemão, a 
preposição muda de forma: "ins Kino" (pra dentro = acusativo) 
vs "im Kino" (dentro = dativo).

Pense nas Wechselpräpositionen como uma porta:
- Se você está ATRAVESSANDO a porta → acusativo (ação)
- Se você está PARADO na porta → dativo (estado)
```

### Section 5: Practice (Contextual Micro-Exercises)

**Purpose**: 3-5 quick exercises that test THIS specific rule, generated from or related to the flashcard that brought the user here.

**Format**: Interactive, with immediate feedback.

**Exercise Types** (vary per module):

1. **Gap-fill with choice**: 
   "Ich gehe ___ Supermarkt" → [in den / in dem / im]
   → Feedback on tap: "Gehe = movimento → acusativo → in den"

2. **Error spotting**:
   "Ich wohne in die Stadt seit zwei Jahren."
   → User taps the error → "die → der (dativo: localização estática)"

3. **Translation with trap**:
   "Eu coloquei o livro na mesa" → fill in German
   → Trap: "na mesa" = movement TO the table → "auf den Tisch" (acusativo)
   vs. "O livro está na mesa" → "auf dem Tisch" (dativo)

4. **Minimal pair discrimination** (for phonological grammar like tones, vowel harmony):
   "Listen: which sentence means 'I went' vs 'apparently went'?"
   → TR: gittim vs gitmiş (evidentiality)

5. **Pattern completion**:
   "Ich gebe ___ Kind ___ Ball"
   → dem Kind den Ball (dativo + acusativo in one sentence)

### Section 6: Related Cards

**Purpose**: Loop back to the flashcard ecosystem. Show 3-5 cards that exercise this same grammar rule.

**Format**: Compact card previews with the PT sentence and target language, tappable to navigate.

---

## 4. Vocabulary Modules

### The Problem with Vocabulary Lists

Traditional vocabulary sections are lists. Lists don't teach — they're reference material. Real vocabulary acquisition happens through:

1. **Semantic networks**: Words connected to related words
2. **Collocational patterns**: Which words go together
3. **Register awareness**: When to use which synonym
4. **Morphological insight**: How to derive new words from known roots

### Vocabulary Module Structure

Each vocabulary module is organized around a **semantic hub** — not a word list, but a concept with radiating connections.

```
SEMANTIC HUB: "Dor / Pain" (Medical context)

                    ┌── dor de cabeça / Kopfschmerzen / headache
                    ├── dor aguda / stechender Schmerz / sharp pain
    Tipos ─────────├── dor crônica / chronischer Schmerz / chronic pain
                    ├── pontada / Stich / stabbing pain
                    └── queimação / Brennen / burning sensation

                    ┌── doer / wehtun / to hurt (impersonal)
    Verbos ────────├── arder / brennen / to burn/sting
                    ├── latejar / pochen / to throb
                    └── irradiar / ausstrahlen / to radiate

                    ┌── desde ontem / seit gestern
    Collocations ──├── cada vez pior / immer schlimmer
                    ├── de 0 a 10 / auf einer Skala von 0 bis 10
                    └── vai e volta / kommt und geht

                    ┌── "Tá doendo" (coloquial oral)
    Register ──────├── "Eu sinto dor" (neutro)
                    ├── "O paciente refere dor" (médico)
                    └── "Estou acometido de dores" (formal escrito)
```

### Vocabulary Teaching Format

**The "5-Layer Word" approach** — each word is taught in 5 layers, progressively:

```
Layer 1 — RECOGNITION
  See the word → know the meaning
  "Kopfschmerzen" → dor de cabeça
  (this is what flashcards already do)

Layer 2 — PRONUNCIATION  
  Hear/say the word correctly
  Kopf·schmer·zen [kɔpfˈʃmɛʁtsn̩]
  Morphemes: Kopf (cabeça) + Schmerzen (dores)
  → German compounds: stress on FIRST element

Layer 3 — USAGE
  Which verbs/prepositions go with this word?
  "Ich habe Kopfschmerzen" (ter, not estar com)
  "Kopfschmerzen VON der Hitze" (caused by)
  "Kopfschmerzen GEGEN Abend" (toward evening)

Layer 4 — DERIVATION
  What other words can I build from this root?
  Schmerz → schmerzhaft (doloroso) → schmerzfrei (sem dor)
  → schmerzstillend (analgésico) → Schmerzgrenze (limiar de dor)
  
Layer 5 — PRODUCTION  
  Can I use this word naturally in my own sentence?
  (Exercise: describe your last headache in 2 sentences)
```

---

## 5. UI/UX Concept

### Design Language

**Aesthetic direction**: "Medical textbook meets Notion" — clean, information-dense, but with warm typography and smart use of whitespace. NOT gamified (no XP bars, no streaks, no confetti). The learning itself is the reward.

**Reference touchpoints**: Notion's readability, Bear app's typography, Anki's density but with taste, Linear's systematic design.

### Navigation Model

```
HOME
├── 📚 My Languages (grid of active languages)
│   ├── 🇩🇪 German
│   │   ├── Flashcards (existing card system)
│   │   ├── Grammar Map (visual topic map with progress)
│   │   └── Vocabulary Hubs (semantic clusters)
│   ├── 🇯🇵 Japanese
│   │   └── ...
│   └── 🇫🇷 French
│       └── ...
│
├── 🎯 Review Queue (smart daily review across all languages)
│
└── 📊 Progress (stats across languages)
```

### Grammar Map View

The Grammar Map is NOT a list. It's a **node graph** where each node is a grammar topic, and connections show dependencies.

```
        ┌──────────┐
        │ Artigos  │ ← Start here
        │ der/die/ │
        │ das      │
        └────┬─────┘
             │
     ┌───────┴────────┐
     │                 │
┌────┴─────┐    ┌─────┴────┐
│Nominativo│    │Acusativo │ ← Unlock after articles
│ (sujeito)│    │ (objeto) │
└────┬─────┘    └─────┬────┘
     │                │
     └───────┬────────┘
             │
      ┌──────┴──────┐
      │   Dativo    │ ← Unlock after Nom + Akk
      │(destinatário│
      └──────┬──────┘
             │
      ┌──────┴──────┐
      │Wechselpräp. │ ← Unlock after Dativ
      │(Akk vs Dat) │
      └─────────────┘
```

**Visual states per node**:
- ○ Locked (grey, prerequisites not met)
- ◐ Available (outlined, ready to start)
- ● In Progress (partially filled, shows % of exercises done)
- ● Complete (filled solid, all exercises passed)

### Grammar Module View (mobile-first)

```
┌─────────────────────────────────────┐
│ ← Alemão > Estrutura > Kasus       │
│                                     │
│ ████████████████████████████████░░  │  Progress bar
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  🎯 O QUE É                    │ │  Section 1: The Insight
│ │                                 │ │
│ │  O dativo em alemão marca quem  │ │
│ │  recebe a ação — não quem a     │ │
│ │  sofre, mas quem é o destina... │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  🔧 COMO FUNCIONA              │ │  Section 2: The Mechanism
│ │                                 │ │
│ │  Masc:  der → dem               │ │
│ │  Fem:   die → der               │ │
│ │  ...                            │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  🧠 A ARMADILHA                │ │  Section 3: The Trap
│ │  ❌ "in die Stadt" (você quer)  │ │
│ │  ✅ "in der Stadt" (correto)    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  🔗 ÂNCORA PT-BR               │ │  Section 4: The Anchor
│ │  "Pense na porta: atravessando  │ │
│ │  = acusativo, parado = dativo"  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │  ✏️ PRATICAR (4 exercícios)     │ │  Section 5: Practice
│ │                                 │ │
│ │  1/4: Ich gehe ___ Supermarkt  │ │
│ │  [ in den ] [ in dem ] [ im ]  │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📎 Cards relacionados               │  Section 6
│ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │Card 1│ │Card 2│ │Card 3│        │
│ └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────┘
```

---

## 6. Content Generation Strategy

### The Challenge: 25 Languages × ~50 Grammar Topics Each = ~1,250 Modules

You can't manually write 1,250 grammar modules. But you CAN:

### Tier 1: AI-Generated with Human-Quality Prompting

Use Claude (Opus for quality) with a **grammar module generation prompt** that enforces:
- The 6-section structure
- PT-BR as metalanguage
- Brazilian-specific error analysis
- Cross-linguistic anchors
- Proper linguistic terminology used naturally
- The "colleague" tone

**The prompt should receive**:
```json
{
  "language": "DE",
  "topic_id": "DE_STRUCT_KASUS_DATIV",
  "topic_name": "Dativo (Dativ)",
  "cluster": "Structure Grammar",
  "level": "A2",
  "prerequisite_topics": ["DE_STRUCT_KASUS_NOM", "DE_STRUCT_KASUS_AKK"],
  "related_card_ids": ["A1-NAV-001", "A2-SOC-001", "B1-DIR-004"],
  "example_sentences": [
    {"pt": "Eu mostrei o mapa ao turista.", "target": "Ich zeigte dem Touristen die Karte."},
    {"pt": "Eu moro na cidade.", "target": "Ich wohne in der Stadt."}
  ]
}
```

**The prompt outputs a complete module as JSON**:
```json
{
  "module_id": "DE_STRUCT_KASUS_DATIV",
  "language": "DE",
  "title": "Dativo (Dativ)",
  "subtitle": "Quem recebe a ação",
  "level": "A2",
  "sections": {
    "insight": "... (3 paragraphs in PT-BR) ...",
    "mechanism": {
      "type": "table",
      "content": { ... }
    },
    "trap": {
      "wrong": "Ich wohne in die Stadt",
      "right": "Ich wohne in der Stadt",
      "explanation": "...",
      "l1_interference": "..."
    },
    "anchor": "... (1-2 paragraphs) ...",
    "exercises": [ ... ],
    "related_cards": ["A1-NAV-001", "A2-SOC-001"]
  }
}
```

### Tier 2: Community/User Corrections

After AI generation, modules get a "suggest correction" button. Users who are advanced speakers or natives can flag errors, suggest better examples, or improve explanations. This creates a quality flywheel.

### Tier 3: Priority-Based Generation

Don't generate all 1,250 at once. Generate on demand:

1. When a user taps a grammar tag on a card, check if the module exists
2. If not, generate it on the fly with Opus (cache the result)
3. Track which modules are accessed most → prioritize quality review for those
4. Pre-generate modules for the most common grammar topics per language

**Priority languages** (generate first, most modules):
- DE, EN, FR, ES, IT → European core (highest user base)
- JA, KO, ZH → CJK (high interest, complex grammar)
- AR, TR, RU → Structurally distinctive (unique grammar worth teaching)

**Lower priority** (generate on demand):
- NL, SV, NO, DA, FI → Nordic/Dutch (smaller audience)
- PL, CS, UK → Slavic (niche but valuable)
- HI, TH, VI, HU, EL → Diverse (generate when accessed)

---

## 7. Linking Strategy: Card ↔ Grammar ↔ Vocabulary

### Every Card References Grammar Modules

In the card JSON, the `grammar` field should contain not just text but a **module reference**:

```json
{
  "grammar": "Wechselpräpositionen: 'in' + Dativ para localização estática",
  "grammar_module_id": "DE_STRUCT_WECHSEL_AKK_DAT",
  "grammar_tags": ["dativ", "wechselpräpositionen", "lokalisation"]
}
```

### Grammar Modules Link to Vocabulary Hubs

Within a grammar module, vocabulary used in examples links to vocabulary hubs:

```
In the dative module, the word "Touristen" appears.
→ Tappable → Opens vocab hub "DE_PEOPLE_PROFESSIONS"
→ Shows: Tourist, Arzt, Lehrer, Patient, Kollege...
→ Each with the 5-layer depth
```

### Vocabulary Hubs Link Back to Grammar

Within a vocabulary hub, certain words trigger grammar notes:

```
In the "Medical Vocabulary" hub, the word "Kopfschmerzen" appears.
→ Note: "Compound nouns: Kopf + Schmerzen. In German, compounds 
   are ONE word, stressed on the FIRST element. Gender comes from 
   the LAST element: der Schmerz → die Kopfschmerzen (plural)."
→ Links to grammar module: DE_MORPH_COMPOUND_NOUNS
```

### The Triangle of Learning

```
     FLASHCARD
    ↗         ↘
GRAMMAR  ←→  VOCABULARY
```

Every entry point leads to the other two. A user can start anywhere and naturally explore deeper.

---

## 8. Technical Implementation Notes

### Database Schema (Key Tables)

```sql
-- Grammar modules
grammar_modules (
  id TEXT PRIMARY KEY,        -- "DE_STRUCT_KASUS_DATIV"
  language TEXT,              -- "DE"
  cluster TEXT,               -- "structure"
  title TEXT,                 -- "Dativo (Dativ)"
  level TEXT,                 -- "A2"
  content JSONB,              -- Full 6-section content
  prerequisites TEXT[],       -- ["DE_STRUCT_KASUS_NOM"]
  related_card_ids TEXT[],    -- Cards that exercise this rule
  created_at TIMESTAMP,
  quality_score FLOAT         -- User ratings / review status
)

-- Vocabulary hubs
vocab_hubs (
  id TEXT PRIMARY KEY,        -- "DE_MED_PAIN"
  language TEXT,
  hub_name TEXT,              -- "Dor / Schmerz"
  semantic_field TEXT,        -- "medical"
  words JSONB,                -- Array of 5-layer word objects
  related_grammar_ids TEXT[]  -- Grammar modules that use these words
)

-- User progress per module
user_grammar_progress (
  user_id TEXT,
  module_id TEXT,
  status TEXT,                -- "locked" | "available" | "in_progress" | "complete"
  exercises_completed INT,
  exercises_total INT,
  last_accessed TIMESTAMP,
  mistakes JSONB              -- Track specific error patterns
)

-- Link table: cards ↔ grammar
card_grammar_links (
  card_id TEXT,
  grammar_module_id TEXT,
  relevance FLOAT             -- How central this grammar is to the card
)
```

### On-Demand Generation Flow

```
User taps grammar tag on card
  → Frontend sends: { language: "DE", topic_id: "DE_STRUCT_KASUS_DATIV" }
  → Backend checks: does grammar_modules have this ID?
    → YES: Return cached module
    → NO: 
      1. Call Opus API with grammar module prompt + context
      2. Parse JSON response
      3. Store in grammar_modules table
      4. Return to frontend
      5. Background: flag for human quality review
```

### Cost Estimation for Generation

- Opus for module generation: ~2,000 tokens input, ~3,000 tokens output per module
- At $15/MTok input + $75/MTok output: ~$0.26 per module
- 1,250 modules × $0.26 = **~$325 total** for complete coverage
- With caching and on-demand: actual cost much lower initially

---

## 9. What Makes This Different from Everything Else

| Feature | Duolingo | Anki | Busuu | This System |
|---|---|---|---|---|
| Grammar depth | Shallow tips | None | Medium | Deep, linguist-level |
| L1 interference analysis | None | None | None | Core feature |
| Cross-linguistic insight | None | None | None | Core feature |
| 25 languages | 40+ | Any | 14 | 25, interconnected |
| Flashcard ↔ Grammar link | Weak | Manual | Weak | Automatic bidirectional |
| Vocabulary as semantic web | No | No | Partially | Yes, 5-layer model |
| Treats learner as adult | No | Neutral | Somewhat | Yes, colleague tone |
| PT-BR specific content | Translation only | User-made | Translation only | Native metalanguage |

---

## 10. MVP Roadmap

### Phase 1: Grammar Tags on Cards (no new pages)
- Add `grammar_module_id` to card JSON schema
- Make grammar tags tappable (link to anchor on same page for now)
- Enrich the grammar field in cards with the new quality standard

### Phase 2: Grammar Module Pages
- Build the 6-section module template as a React component
- Generate top 50 modules for DE, EN, FR, ES, JA (= 250 modules)
- Implement the card → module navigation

### Phase 3: Grammar Map
- Build the node graph visualization
- Implement prerequisite logic and progress tracking
- Connect to user progress database

### Phase 4: Vocabulary Hubs
- Build the semantic hub component
- Generate top 20 hubs per priority language
- Implement the 5-layer word view

### Phase 5: Practice Engine
- Build the exercise component library (gap-fill, error-spot, translate, minimal pair)
- Integrate exercise results into SRS scheduling
- Implement the "mistake → relevant grammar module" recommendation
