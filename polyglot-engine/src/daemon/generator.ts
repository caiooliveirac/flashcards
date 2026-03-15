import { GENERATION_BATCHES } from "../lib/tiers";
import { readFileSync } from "fs";
import { join } from "path";

const SYSTEM_PROMPT = (() => {
    // In Docker, data is at /app/data/; in dev, relative to project root
    const paths = [
        join(process.cwd(), "data", "system-prompt.txt"),
        join(__dirname, "..", "data", "system-prompt.txt"),
        join(process.cwd(), "src", "data", "system-prompt.txt"),
    ];
    for (const p of paths) {
        try {
            return readFileSync(p, "utf-8");
        } catch {
            // try next
        }
    }
    throw new Error("system-prompt.txt not found in any expected location");
})();

export interface BatchOutput {
    batchName: string;
    langs: readonly string[];
    raw: string;
    parsed: Record<string, Record<string, string>>; // langCode -> field -> value
    notaGlobal?: string;
    stopReason: string;
    usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
    };
    durationMs: number;
}

/** Attempt to repair common JSON issues from model output:
 *  - Markdown code fences (```json ... ```)
 *  - Unescaped control characters inside strings (newlines, tabs)
 *  - Trailing commas before } or ]
 */
function stripMarkdownFences(text: string): string {
    // Remove ```json ... ``` wrapping (complete response)
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    // Handle truncated response: opening fence present but closing fence was cut off
    const openOnly = text.match(/^```(?:json)?\s*\n?([\s\S]*)/);
    if (openOnly) return openOnly[1].trim();
    return text.trim();
}

function sanitizeJson(text: string): string {
    // 1. Fix unescaped control characters inside JSON string values
    let result = "";
    let inString = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inString) {
            if (ch === "\\" && i + 1 < text.length) {
                result += ch + text[i + 1];
                i += 2;
                continue;
            }
            if (ch === '"') {
                const rest = text.substring(i + 1).trimStart();
                if (
                    rest.length === 0 ||
                    rest[0] === "," || rest[0] === "}" || rest[0] === "]" ||
                    rest[0] === ":"
                ) {
                    result += ch;
                    inString = false;
                } else {
                    result += '\\"';
                }
                i++;
                continue;
            }
            if (ch === "\n") { result += "\\n"; i++; continue; }
            if (ch === "\r") { result += "\\r"; i++; continue; }
            if (ch === "\t") { result += "\\t"; i++; continue; }
            result += ch;
        } else {
            if (ch === '"') { inString = true; }
            result += ch;
        }
        i++;
    }
    // 2. Remove trailing commas before } or ]
    result = result.replace(/,(\s*[}\]])/g, "$1");
    return result;
}

/** Try to complete truncated JSON by closing all open braces/brackets. */
function closeOpenBraces(text: string): string {
    const opens: string[] = [];
    let inStr = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
            if (ch === "\\" && i + 1 < text.length) { i++; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === "{") opens.push("}");
        else if (ch === "[") opens.push("]");
        else if (ch === "}" || ch === "]") opens.pop();
    }
    // Remove trailing partial string/key/value (anything after last complete value)
    let trimmed = text.replace(/,?\s*"[^"]*$/, "");       // partial key or string value
    trimmed = trimmed.replace(/,?\s*"[^"]*":\s*$/, "");   // key with no value
    return trimmed + opens.reverse().join("");
}

type ModelOutput = {
    nota_global?: string;
    tag_line?: string;
    translations?: Record<string, Record<string, unknown>>;
};

/** Parse JSON output from Haiku into a per-language flat field map.
 *  Exported so it can be called from assembler (deferred parse). */
export function parseJSONOutput(raw: string, truncated: boolean = false): {
    parsed: Record<string, Record<string, string>>;
    notaGlobal?: string;
} {

    // Step 0: Strip markdown fences if present
    let text = stripMarkdownFences(raw);

    let json: ModelOutput;
    try {
        json = JSON.parse(text) as ModelOutput;
    } catch (firstErr) {
        // Step 1: Sanitize (fix unescaped chars, trailing commas)
        let cleaned = sanitizeJson(text);
        try {
            json = JSON.parse(cleaned) as ModelOutput;
        } catch {
            // Step 2: Extract JSON object via regex
            const match = cleaned.match(/\{[\s\S]*\}/);
            if (match) cleaned = match[0];

            // Step 3: If truncated, try closing open braces
            if (truncated) {
                cleaned = closeOpenBraces(cleaned);
            }

            try {
                json = JSON.parse(cleaned) as ModelOutput;
                console.warn("[GEN] JSON parsed via deep recovery");
            } catch (finalErr) {
                const posMatch = String(finalErr).match(/position (\d+)/);
                if (posMatch) {
                    const pos = parseInt(posMatch[1], 10);
                    console.error(`[GEN] JSON error at pos ${pos}: ...${cleaned.substring(Math.max(0, pos - 80), pos + 80)}...`);
                }
                throw firstErr;
            }
        }
    }

    const parsed: Record<string, Record<string, string>> = {};
    const translations = json.translations ?? {};

    // JSON field name → assembler/DB field name mapping
    const FIELD_RENAMES: Record<string, string> = {
        typical_error: "erroTipico",
        reusable_pattern: "padraoReutilizavel",
        trigger: "gatilho",
        register: "registro",
        trap: "armadilha",
        contrast: "contraste",
        note: "obs",
        pattern: "padrao",
        grammar: "gramatica",
        colloquial: "variacaoNativa",
        romanization: "romanizacao",
    };

    for (const [langCode, rawBlock] of Object.entries(translations)) {
        const block = rawBlock as Record<string, unknown>;
        const flat: Record<string, string> = { langCode };

        for (const [key, value] of Object.entries(block)) {
            // Flatten the thesaurus object into top-level fields
            if (key === "thesaurus" && typeof value === "object" && value !== null) {
                const th = value as Record<string, unknown>;
                if (th.synonyms) flat.sinonimos = Array.isArray(th.synonyms) ? (th.synonyms as string[]).join(";") : String(th.synonyms);
                if (th.antonym) flat.antonimo = String(th.antonym);
                if (th.collocations) flat.collocations = Array.isArray(th.collocations) ? (th.collocations as string[]).join(",") : String(th.collocations);
                if (th.semantic_field) flat.campoSemantico = Array.isArray(th.semantic_field) ? (th.semantic_field as string[]).join(",") : String(th.semantic_field);
                if (th.register_variations) {
                    const rv = th.register_variations as Record<string, string>;
                    flat.registroVariacoes = Object.entries(rv).map(([k, v]) => `${k}:${v}`).join(";");
                }
                continue;
            }

            const mappedKey = FIELD_RENAMES[key] ?? key;
            flat[mappedKey] = value == null ? "" : String(value);
        }

        parsed[langCode] = flat;
    }

    return {
        parsed,
        notaGlobal: json.nota_global || undefined,
    };
}

/** Estimate max output tokens for a batch. Non-Latin scripts (CJK, Arabic,
 *  Hebrew, Greek, Thai) generate ~40% more tokens due to romanization in
 *  every thesaurus entry. Budget ~1300 tokens/lang + overhead. */
function maxTokensForBatch(langCount: number, includeNota: boolean): number {
    const notaTokens = includeNota ? 500 : 0;
    return Math.min(8192, Math.ceil(langCount * 1300 * 1.15) + notaTokens + 400);
}

async function callHaiku(
    chunkPt: string,
    contexto: string,
    batchLangs: readonly string[],
    batchName: string,
    includeNota: boolean = false,
    grammarFocus?: string[],
    teaches?: string,
    maxTokensOverride?: number
): Promise<{ text: string; stopReason: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } }> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    let userPrompt = `CHUNK: "${chunkPt}"
CTX: ${contexto}
LANGS: ${batchLangs.join(",")}
NOTA: ${includeNota ? "yes" : "no"}`;

    // Inject didactic metadata when available — guides the model's focus
    if (grammarFocus?.length) {
        userPrompt += `\nFOCO: ${grammarFocus.join(", ")}`;
    }
    if (teaches) {
        userPrompt += `\nOBJETIVO: ${teaches}`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
            model: "claude-haiku-4-5-20251001",
            max_tokens: maxTokensOverride ?? maxTokensForBatch(batchLangs.length, includeNota),
            temperature: 0,
            system: [
                {
                    type: "text",
                    text: SYSTEM_PROMPT,
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const errBody = await response.text();

        // Retry on rate-limit (429) with exponential backoff
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("retry-after") ?? "0", 10);
            const waitMs = Math.max(retryAfter * 1000, 30_000);
            console.warn(`[GEN] ${batchName}: rate limited, waiting ${waitMs / 1000}s...`);
            await new Promise((r) => setTimeout(r, waitMs));
            return callHaiku(chunkPt, contexto, batchLangs, batchName, includeNota, grammarFocus, teaches, maxTokensOverride);
        }

        throw new Error(`Anthropic API ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
        stop_reason: string;
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };

    const text = data.content.find((c) => c.type === "text")?.text ?? "";

    const truncated = data.stop_reason === "max_tokens";
    console.log(
        `[GEN] ${batchName}: ${data.usage.input_tokens}in/${data.usage.output_tokens}out` +
        (data.usage.cache_read_input_tokens ? ` (${data.usage.cache_read_input_tokens} cached)` : "") +
        (truncated ? " ⚠️TRUNCATED" : "")
    );

    // Retry once with max budget (8192) when truncated and we haven't already done so
    if (truncated && !maxTokensOverride) {
        console.warn(`[GEN] ${batchName}: truncated at ${data.usage.output_tokens} tokens — retrying with 8192`);
        const retry = await callHaiku(chunkPt, contexto, batchLangs, batchName, includeNota, grammarFocus, teaches, 8192);
        // Merge token usage: first call + retry call
        retry.usage.input_tokens += data.usage.input_tokens;
        retry.usage.cache_read_input_tokens += data.usage.cache_read_input_tokens ?? 0;
        retry.usage.cache_creation_input_tokens += data.usage.cache_creation_input_tokens ?? 0;
        return retry;
    }

    return {
        text,
        stopReason: data.stop_reason ?? "end_turn",
        usage: {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens,
            cache_read_input_tokens: data.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: data.usage.cache_creation_input_tokens ?? 0,
        },
    };
}

export async function generateBatch(
    chunkPt: string,
    contexto: string,
    batchIndex: number,
    includeNota: boolean = false,
    grammarFocus?: string[],
    teaches?: string
): Promise<BatchOutput> {
    const batch = GENERATION_BATCHES[batchIndex];
    if (!batch) throw new Error(`Invalid batch index: ${batchIndex}`);

    const start = Date.now();
    const result = await callHaiku(chunkPt, contexto, batch.langs, batch.name, includeNota, grammarFocus, teaches);
    const durationMs = Date.now() - start;

    // Parse is deferred to assembler — raw is saved to DB first by daemon.
    // We still try parsing here to report notaGlobal, but failure is NOT fatal.
    const truncated = result.stopReason === "max_tokens";
    let parsed: Record<string, Record<string, string>> = {};
    let notaGlobal: string | undefined;

    try {
        const result2 = parseJSONOutput(result.text, truncated);
        parsed = result2.parsed;
        notaGlobal = result2.notaGlobal;
        if (notaGlobal) {
            console.log(`[GEN] ${batch.name}: notaGlobal extracted (${notaGlobal.length} chars)`);
        }
    } catch (parseErr) {
        // Not fatal — raw will be saved to DB and can be re-parsed later
        console.warn(`[GEN] ${batch.name}: parse deferred (${parseErr instanceof Error ? parseErr.message.substring(0, 80) : "unknown"})`);
    }

    // Verify all expected langs are present (only if parsed succeeded)
    if (Object.keys(parsed).length > 0) {
        const missing = batch.langs.filter((l) => !parsed[l]);
        if (missing.length > 0) {
            console.warn(`[GEN] ${batch.name}: missing langs: ${missing.join(", ")}`);
        }
    }

    return {
        batchName: batch.name,
        langs: batch.langs,
        raw: result.text,
        parsed,
        notaGlobal,
        stopReason: result.stopReason,
        usage: result.usage,
        durationMs,
    };
}

export async function generateAllBatches(
    chunkPt: string,
    contexto: string,
    grammarFocus?: string[],
    teaches?: string
): Promise<BatchOutput[]> {
    // Run batches in pairs with 15s delay between pairs to stay under
    // 10k output tokens/min rate limit. Cache TTL is 5 min — sequential
    // execution within ~3 min still hits the cache after the first batch.
    const results: BatchOutput[] = [];
    const pairDelay = 15_000;

    for (let i = 0; i < GENERATION_BATCHES.length; i += 2) {
        const pair = [i, i + 1].filter((idx) => idx < GENERATION_BATCHES.length);
        const pairResults = await Promise.all(
            pair.map((idx) =>
                generateBatch(chunkPt, contexto, idx, idx === 0, grammarFocus, teaches)
            )
        );
        results.push(...pairResults);

        // Pause between pairs (skip after last pair)
        if (i + 2 < GENERATION_BATCHES.length) {
            await new Promise((r) => setTimeout(r, pairDelay));
        }
    }

    return results;
}
