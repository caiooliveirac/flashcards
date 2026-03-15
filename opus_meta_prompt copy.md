# Meta-Prompt for Opus 4.6: Rewrite the Haiku Flashcard System Prompt

You are tasked with creating a new **system prompt** for Claude Haiku 3.5 that will be used in a **batch translation pipeline** for a polyglot flashcard application supporting 25 languages.

## Context & Constraints

### Backend Requirements
- The Haiku model receives chunks of Brazilian Portuguese sentences and must return **pure JSON** — no markdown fences, no preamble, no trailing text. The backend parses the response directly with `JSON.parse()`. Any non-JSON output breaks the pipeline.
- Each chunk contains multiple sentences grouped by category (e.g., `basic_opinions`, `daily_routine`, `travel`). Haiku must translate each sentence into the target language and produce structured card data.

### Cost Optimization via Prompt Caching
- This system prompt will be identical across 100+ sequential API calls (one per chunk), with only the user message (the JSON chunk) changing.
- The Anthropic API enables **prompt caching** for system prompts ≥ 4,096 tokens. Cached reads cost **10x less** than normal input tokens.
- Therefore, this system prompt **must exceed 4,096 tokens** to qualify for caching. Use every token wisely — pack it with pedagogical depth, formatting rules, linguistic guidelines, and quality examples rather than filler.
- Since Haiku is a smaller model, a detailed system prompt significantly improves output quality. This is not padding — it's teaching.

### Token Economy on Output
- Pure JSON (no markdown, no commentary) saves output tokens. Reinforce this constraint clearly.

---

## What the Current Prompt Produces (and Why It's Weak)

Here is an example card for German. Study it carefully to understand the JSON schema, but also notice the pedagogical poverty:

```
Language: DE
Formal: Ich bevorzuge Tee. Kaffee ist zu stark für mich.
Colloquial: Ich mag lieber Tee. Kaffee is mir zu stark.
Literal: Eu prefiro chá. Café é demais forte para mim.
Pattern: [Subj]+[V2]+[Obj]. [Subj]+[V]+[Adj]+[Adv]+[PP]
Grammar: Declarativa SVO com V2 em segunda posição; "zu" + adj marca excesso; "für" + acusativo marca limite pessoal
Note: Alemão exige "zu" (advérbio de grau) antes de adjetivo predicativo; "bevorzugen" rege acusativo direto, não infinitivo
Typical Error: Brasileiro diz "Kaffee ist sehr stark für mich" omitindo "zu" (muito vs demais)
Contrast: EN omite "zu" ("too strong"), DE exige; FR usa "trop" (advérbio invariável)
Trap: "für" parece "para" mas rege acusativo, não dativo; "Kaffee" é masculino (der Kaffee) mas predicativo não concorda
Reusable Pattern: Ich bevorzuge [COISA]. [COISA] ist zu [ADJ] für mich.
Trigger: Expressar preferência pessoal com justificativa de limite
Register: neutro-polido
Thesaurus Synonyms: Ich mag lieber Tee;Ich ziehe Tee vor;Tee ist mir lieber
Thesaurus Antonym: Kaffee ist mir recht
Thesaurus Collocations: zu stark,zu bitter,zu heiß,für mich
Thesaurus Semantic Field: Vorliebe,Geschmack,Neigung,Abneigung,Grenze
Thesaurus Register Variations: formal:Ich bevorzuge Tee. Kaffee ist mir zu intensiv;coloquial:Ich mag lieber Tee. Kaffee is mir zu stark
```

### Problems to Fix

1. **Global Note is shallow and disconnected.** It reads like a list of isolated factoids glued with semicolons. It should read like a **mini-lesson from a skilled language teacher** — a flowing paragraph that tells a coherent story about how this structure works in the target language, what's tricky for a Brazilian Portuguese speaker, and what insight makes it click. Think of it as 3-5 sentences of connected, didactic prose — not bullet points in disguise.

2. **Grammar field is trivially obvious.** Saying "SVO with V2" teaches nothing to someone at B1+. Real grammar teaching means: case governance (which case does this verb/preposition demand?), particles and their effects, separable prefix behavior, subjunctive triggers, genitive vs. dative alternation, postposition quirks, classifier systems, vowel harmony — whatever is **actually non-obvious** about the structure in that language. Pick the most useful grammatical insight for that specific sentence.

3. **Thesaurus lacks romanization.** For languages with non-Latin scripts (Japanese, Korean, Arabic, Hindi, Russian, Greek, Chinese, Thai, Georgian, Armenian, etc.), every entry in the thesaurus — synonyms, antonyms, collocations, semantic field, register variations — must include romanization (romaji, romanized Korean, pinyin, etc.) so the learner can actually pronounce what they're reading.

4. **Thesaurus lacks PT-BR translation.** Every synonym, antonym, and register variation should also carry a brief Portuguese translation so the learner can connect meaning without leaving the card.

5. **Typical Error is generic.** "Brasileiro diz X" is a start, but explain *why* the error happens (L1 interference pattern) and how to remember the correct form. Make it a teaching moment, not just an error flag.

6. **Contrast field is superficial.** Don't just say "EN does X, DE does Y." Explain the *principle* behind the difference — is it about morphological agreement? Syntactic position? Semantic scope? One sentence of insight beats three sentences of surface comparison.

7. **Reusable Pattern needs PT-BR gloss.** The slot-filler pattern is great, but add a Portuguese mirror so the learner sees the structural mapping: `Ich bevorzuge [COISA]. [COISA] ist zu [ADJ] für mich. → Eu prefiro [COISA]. [COISA] é [ADJ] demais pra mim.`

8. **Literal translation should be truly word-for-word.** Not a natural Portuguese sentence, but a morpheme-by-morpheme gloss that reveals the target language's structure. For German: "Eu prefiro chá. Café é demasiado forte para mim" — each word maps 1:1. For Japanese or Korean, this is especially valuable to show particle placement.

---

## New System Prompt Requirements

Create a system prompt for Haiku that:

### Structure & Format
- Opens with a clear identity statement (you are a polyglot flashcard engine)
- States the **pure JSON output** requirement emphatically — no markdown, no backticks, no preamble, no trailing text, just raw JSON
- Defines the exact JSON schema with every field explained
- Provides 2-3 complete card examples showing ideal quality (use different languages to demonstrate script/romanization handling)

### Pedagogical Guidelines (this is where the 4096+ tokens earn their keep)

**For the `note` field (Global Note):**
- Write 3-5 sentences of **connected, flowing prose** in Brazilian Portuguese
- Adopt the voice of an experienced, enthusiastic polyglot teacher
- Explain how the grammatical structure works in the target language
- Highlight what's counterintuitive or tricky for a PT-BR speaker specifically
- Connect to a memorable insight, mnemonic, or "aha moment"
- Never produce a list of disconnected facts separated by periods

**For the `grammar` field:**
- Go beyond surface word order (SVO/SOV is banned as the sole content)
- Focus on: case requirements, verb governance, preposition/postposition behavior, particle functions, agreement rules, tense/aspect distinctions, classifier usage, honorific levels, vowel harmony, tone patterns — whatever is the **most teachable grammatical insight** for that specific sentence in that specific language
- Write in PT-BR, concise but substantive (2-3 sentences max)

**For the `thesaurus` object:**
- Every entry in a non-Latin script language MUST include romanization in parentheses
- Every synonym and register variation MUST include a brief PT-BR translation after a dash
- Format: `"Targetphrase (romanization) — tradução PT-BR"` for non-Latin; `"Targetphrase — tradução PT-BR"` for Latin-script languages
- Collocations and semantic field terms also get romanization for non-Latin scripts

**For `literal` (literal translation):**
- Produce a true **word-for-word morpheme gloss** in PT-BR that mirrors the target language's word order and structure
- This is NOT a natural Portuguese sentence — it should feel "broken" in Portuguese to reveal the foreign structure
- For agglutinative languages, show morpheme boundaries: "Eu-SUJ chá-OBJ preferir-PRES" style glossing

**For `typical_error`:**
- State the error a Brazilian would make
- Explain the L1 interference pattern causing it (why does Portuguese structure mislead here?)
- Give a micro-tip for remembering the correct form

**For `contrast`:**
- Compare the target language structure to 1-2 other languages the learner might know
- Focus on the **underlying principle**, not surface differences
- One sentence of "why" beats three sentences of "what"

**For `reusable_pattern`:**
- Provide the slot-filler template in the target language
- Add a parallel PT-BR template showing structural correspondence
- Use clear slot markers: [SUBSTANTIVO], [VERBO], [ADJETIVO], [PESSOA], etc.

**For `trap`:**
- Identify the most dangerous false cognate, false friend, or structural trap
- Explain why it's deceptive and how it leads to real miscommunication (not just grammatical incorrectness)

**For `register`:**
- Be specific: `neutro-polido`, `informal-urbano`, `formal-acadêmico`, `coloquial-oral`, etc.

### Language-Specific Awareness

Include a section in the prompt reminding Haiku of key typological features to watch for per language family:

- **Germanic (DE, NL, SV, NO, DA):** V2 word order, separable prefixes, case system (DE/sometimes archaic in NL), compound nouns, definite article usage in generics (Nordic)
- **Romance (FR, IT, ES):** gendered articles, subjunctive triggers, clitic pronouns, partitive (FR), preposition contractions, reflexive constructions
- **English:** phrasal verbs, article system for PT-BR speakers, gerund vs infinitive, preposition collocations
- **Slavic (RU, PL, CS — if applicable):** case system (6-7 cases), verbal aspect (perfective/imperfective), motion verbs with prefixes
- **CJK (JA, ZH, KO):** particles (JA/KO), classifiers/counters, honorific levels (JA/KO), tone (ZH), topic-comment structure, SOV (JA/KO), SVO (ZH)
- **Arabic (AR):** root-pattern morphology, definite article al-, case endings (formal), masculine/feminine verb agreement, hollow/geminate verbs
- **Turkish (TR):** vowel harmony, agglutination, SOV, postpositions, no grammatical gender, evidentiality marker -miş
- **Hindi (HI):** SOV, postpositions, split ergativity, honorific verb forms, gender in verbs
- **Thai (TH):** isolating/analytic, classifiers, no inflection, serial verb constructions, particles for politeness, tones
- **Greek (EL):** rich inflection, subjunctive without infinitive, clitic doubling, augment in past tenses

### Output Schema

Specify the exact JSON schema. Here is the structure that the backend expects (the model must produce this exactly):

```json
{
  "cards": [
    {
      "id": "string — preserve the original chunk ID",
      "category": "string — preserve the original category",
      "source_pt": "string — the original Brazilian Portuguese sentence",
      "tag_line": "string — emoji 🎯 + concise functional tag in EN (e.g., 'Preference + justification')",
      "note": "string — the flowing pedagogical note in PT-BR (3-5 connected sentences, teacher voice)",
      "translations": {
        "LANG_CODE": {
          "formal": "string — standard/formal register translation",
          "colloquial": "string — natural spoken/colloquial variant",
          "romanization": "string | null — romanized pronunciation (required for non-Latin scripts, null for Latin-script languages)",
          "literal": "string — word-for-word morpheme gloss in PT-BR revealing target structure",
          "pattern": "string — syntactic skeleton with labeled slots",
          "grammar": "string — substantive grammatical insight in PT-BR (NOT just word order)",
          "note": "string — language-specific observation in PT-BR",
          "typical_error": "string — common Brazilian error + L1 interference explanation + memory tip",
          "contrast": "string — principled comparison with 1-2 other languages",
          "trap": "string — dangerous false friend/cognate/structural trap with explanation",
          "reusable_pattern": "string — slot-filler template in target lang + PT-BR parallel",
          "trigger": "string — communicative situation that activates this pattern",
          "register": "string — specific register label (e.g., neutro-polido, informal-urbano)",
          "thesaurus": {
            "synonyms": ["string — with romanization if non-Latin + PT-BR translation"],
            "antonym": "string — with romanization if non-Latin + PT-BR translation",
            "collocations": ["string — with romanization if non-Latin"],
            "semantic_field": ["string — with romanization if non-Latin"],
            "register_variations": {
              "formal": "string — formal variant + PT-BR translation",
              "colloquial": "string — colloquial variant + PT-BR translation"
            }
          }
        }
      }
    }
  ]
}
```

**Important:** The `translations` object will contain whichever language codes are requested in the user message chunk. The model must handle any of the 25 supported languages.

### Supported Language Codes
AR, CS, DA, DE, EL, EN, ES, FR, HI, IT, JA, KO, NL, NO, PL, PT, RU, SV, TH, TR, UK, VI, ZH, FI, HU

### Romanization Requirements by Language
- **Always required:** JA (romaji), KO (revised romanization), ZH (pinyin), AR (standard romanization), HI (IAST/simple), RU (scientific transliteration), UK (Ukrainian transliteration), EL (Greek romanization), TH (RTGS)
- **Never required (Latin script):** DE, EN, ES, FR, IT, NL, NO, DA, SV, PL, CS, TR, FI, HU, VI (note: Vietnamese uses Latin script with diacritics)
- Romanization goes in the `romanization` field AND inline in thesaurus entries for non-Latin languages

### Quality Examples

Include 2-3 fully worked examples in the system prompt showing ideal output for:
1. A **Germanic language** (e.g., German) — demonstrating case/grammar depth
2. A **CJK language** (e.g., Japanese) — demonstrating romanization + particle analysis
3. A **Romance language** (e.g., French) — demonstrating subjunctive/clitic handling

These examples are critical — Haiku learns primarily from examples, not abstract rules. Make each example card a masterclass in what a great flashcard looks like.

---

## Final Deliverable

Produce the complete system prompt as a single text block. It must:
- Be self-contained (Haiku receives only this prompt + the JSON chunk)
- Exceed 4,096 tokens to enable prompt caching
- Be in English (the working language of the prompt) with PT-BR specified for output fields
- Contain no markdown formatting that would confuse Haiku into producing markdown output
- End with a clear "RESPOND WITH PURE JSON ONLY" instruction

Do not produce the JSON output yourself. Produce only the system prompt that will make Haiku produce excellent JSON output.
