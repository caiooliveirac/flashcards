# Token Cost Optimization Audit — Senior AI Engineer Prompt

> **How to use:** Paste this prompt into VS Code Copilot Chat (Opus 4.6) with your full codebase open. Use `@workspace` to give it full context. Run it as a single shot.

---

```
@workspace

You are a senior LLM cost-optimization engineer performing a full audit of this codebase. Your mission: dramatically reduce Anthropic API token consumption WITHOUT destroying the application skeleton, feature set, or 25-language support.

## CONTEXT

This is a language-learning application (DeutschTutor Pro / DeutschBrücke) that makes Anthropic API calls to generate content cards with fields across 25 languages, including a rich global note per card. The problem: token costs are too high. The architecture likely wastes tokens through verbose prompts, chatty model responses, redundant context per request, and missed caching opportunities.

## YOUR TASK

Scan every file in this project. Find every Anthropic API call, every prompt template, every system message, every response handler. Then execute the following attack plan:

---

### PHASE 1: PROMPT SURGERY — Eliminate verbosity

For every prompt/system message in the codebase:

1. **Strip all natural language instructions that can be replaced by schema contracts.** The model does NOT need "Please provide a JSON object with the following fields...". It needs a JSON schema and a one-line directive: `Respond ONLY with valid JSON matching this schema. No explanation, no markdown, no preamble.`

2. **Replace prose field descriptions with compact inline comments inside the schema itself.** Instead of a paragraph explaining what `etymology` means, put it inside the JSON schema as a 5-word comment.

3. **Audit every system prompt for redundant phrasing.** LLMs don't need politeness tokens ("Please", "Could you kindly", "I would like you to"). Kill them all. Every token in the system prompt is multiplied by every request.

4. **Collapse multi-paragraph instructions into bullet-compressed directives.** Example:
   - BEFORE (wasteful): "For each language, you should provide the translation of the word. Make sure to include the phonetic transcription using IPA notation. Also include any relevant grammatical notes such as gender, plural forms, or conjugation patterns."
   - AFTER (tight): `For each lang: {translation, ipa, grammar_notes(gender/plural/conj)}`

5. **Enforce a strict JSON-only response contract.** Add to EVERY API call:
   - In the system prompt: `OUTPUT: raw JSON only. No markdown fences. No explanation. No preamble. No postamble.`
   - Set `stop_sequences` if applicable to catch runaway text.
   - In response parsing: strip any accidental non-JSON prefix/suffix before `JSON.parse()`.

6. **Use short key names in JSON schemas sent to and received from the API.** Map verbose keys to compact keys on the backend. Example:
   - API contract: `{w: "word", tr: [{l: "pt", t: "casa", ip: "ˈka.zɐ", g: "f"}], gn: "global note..."}`  
   - Backend hydrates: `{word: "word", translations: [{lang: "pt", translation: "casa", ipa: "ˈka.zɐ", gender: "f"}], globalNote: "..."}`
   - This alone can save 20-40% on output tokens across 25 languages.

---

### PHASE 2: ANTHROPIC PROMPT CACHING — Exploit cache_control

Anthropic supports prompt caching via `cache_control: {type: "ephemeral"}` on message blocks. This can reduce costs by up to 90% on cached prefixes.

1. **Identify the STATIC portion of every system prompt.** Everything that doesn't change per-request (schema definitions, language lists, formatting rules, the 25-language code list) MUST be in a cached block.

2. **Structure every API call as:**
   ```
   messages: [
     {
       role: "system",  // or use the system parameter
       content: [
         {
           type: "text",
           text: "<STATIC_SYSTEM_PROMPT>",  // schema, rules, lang list — CACHEABLE
           cache_control: { type: "ephemeral" }
         },
         {
           type: "text",
           text: "<DYNAMIC_PER_REQUEST>"  // the specific word/topic
         }
       ]
     }
   ]
   ```

3. **The static block should contain:**
   - The JSON output schema (compact version with short keys)
   - The complete list of 25 language codes
   - All behavioral directives (JSON-only, no explanation, etc.)
   - Any reusable context (what the app is, what a "card" is)
   
4. **The dynamic block should contain ONLY:**
   - The specific word/phrase to generate a card for
   - Any user-specific overrides (e.g., difficulty level)
   - This block should be as small as possible — ideally under 100 tokens.

5. **Verify the implementation:** After restructuring, the `cache_creation_input_tokens` and `cache_read_input_tokens` fields in the API response should show cache hits on subsequent calls. Log these. If `cache_read_input_tokens` is 0 on the 2nd+ call, the caching isn't working — the static prefix probably changed.

---

### PHASE 3: BACKEND PROMPT ASSEMBLY — Move intelligence server-side

1. **The backend should own prompt construction, not the frontend.** If prompts are assembled in frontend code, move them to a server-side prompt builder. This:
   - Prevents prompt leakage to users
   - Allows A/B testing of prompts without deploys  
   - Enables centralized cache-key management

2. **Create a `PromptBuilder` class/module** that:
   - Holds the static cached prefix as a constant
   - Accepts only the dynamic variables (word, difficulty, etc.)
   - Returns the complete messages array ready for the API call
   - Handles the short-key → full-key hydration of responses

3. **Implement response validation:**
   - `JSON.parse()` with try/catch
   - Schema validation (zod, ajv, or manual) to reject malformed responses
   - Automatic retry with a stricter prompt on parse failure (max 1 retry)
   - On retry, prepend: `Your previous response was not valid JSON. Respond with ONLY a raw JSON object.`

---

### PHASE 4: MODEL SELECTION & PARAMETER TUNING

1. **Audit which model is used for each endpoint.** Not every call needs Opus. Classify:
   - **Opus-worthy:** Global note generation (rich, nuanced, educational — this CAN be longer and richer, the user explicitly wants this)
   - **Sonnet-tier:** Card field generation across 25 languages (structured, predictable, schema-following)
   - **Haiku-tier:** Simple translations, IPA lookups, grammar gender classification

2. **Set `max_tokens` precisely per endpoint.** Don't use a generic `max_tokens: 4096` everywhere. Estimate the actual output size:
   - A 25-language card with short keys: ~800-1200 tokens
   - A rich global note: ~300-600 tokens
   - Set max_tokens to 1.3x the expected size, not 4x

3. **Set `temperature: 0` for all structured/translation tasks.** Only use temperature > 0 for the global note if creative variation is desired.

---

### PHASE 5: ARCHITECTURAL PATTERNS

1. **Batch where possible.** If generating multiple cards, use a single prompt that asks for an array of cards instead of N separate API calls. The system prompt is paid once.

2. **Consider splitting the card generation into two calls if the global note is the expensive part:**
   - Call 1 (Haiku/Sonnet): Generate the 25-language structured fields → fast, cheap, cacheable schema
   - Call 2 (Opus): Generate ONLY the global note, receiving the word + minimal context → rich output where it matters
   - This lets you use the expensive model only where quality justifies cost.

3. **Cache generated cards aggressively on your backend.** If someone else requests the same word, serve from DB, don't re-generate. Implement a card cache layer (Redis, SQLite, or even a JSON file for MVP).

4. **Deduplicate language data.** If 25 languages share a common schema, send the schema ONCE with a `for each of [lang_codes]` directive, not 25 separate field definitions.

---

### PHASE 6: RESPONSE SIZE CONTROL

1. **The global note is the ONE place where richness is desired.** The user explicitly wants this to be longer, richer, more educational. Do NOT compress this. In fact, improve the global note prompt to ask for etymological depth, usage nuances, cultural context, and memorable learning hooks. This is the premium content — it's worth the tokens.

2. **Everything else should be as compact as possible:**
   - Translations: just the translated word/phrase
   - IPA: just the transcription string
   - Grammar notes: abbreviated (e.g., "m.sg" not "masculine singular")
   - Example sentences: ONE short sentence per language, max 10 words
   - If any field can be derived or looked up without LLM (like language names from codes), do it on the backend, don't ask the LLM

3. **Explicitly tell the model the max length for each field:**
   ```
   gn: "Global note, 150-250 words, rich educational content",
   tr[].t: "translation, 1-4 words",
   tr[].ex: "example sentence, max 10 words"
   ```

---

## DELIVERABLES

After your audit, for each file you modify:

1. Show the BEFORE and AFTER of every prompt/system message
2. Show the estimated token reduction (even rough %)  
3. Show the caching structure (what's static vs dynamic)
4. Show model selection per endpoint
5. Show the PromptBuilder implementation
6. Show the short-key mapping and hydration logic

Be surgical. Be aggressive on cost. Be protective of the skeleton and the 25-language feature set. The global note gets BETTER, everything else gets LEANER.

Do NOT ask me questions. Start the audit now. Scan every file and begin modifications.
```

---

## Quick Reference: Expected Savings

| Technique | Estimated Saving | Effort |
|---|---|---|
| JSON-only responses (no chat) | 15-25% output tokens | Low |
| Short JSON keys | 20-40% output tokens | Medium |
| Prompt caching (static prefix) | 60-90% input tokens on repeat calls | Medium |
| Precise `max_tokens` per endpoint | Prevents overspend on capped calls | Low |
| Model tiering (Haiku for simple fields) | 50-80% cost on structured tasks | Medium |
| Backend prompt assembly | Enables all above + A/B testing | Medium |
| Card-level DB caching | 100% saving on repeat words | High |
| Compact field directives | 30-50% system prompt tokens | Low |

**Combined realistic estimate: 50-75% total cost reduction** without losing any features or quality. The global note actually improves.
