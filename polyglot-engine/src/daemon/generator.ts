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
    usage: {
        input_tokens: number;
        output_tokens: number;
        cache_read_input_tokens: number;
        cache_creation_input_tokens: number;
    };
    durationMs: number;
}

/** Parse JSON output from Haiku into a per-language flat field map. */
function parseJSONOutput(raw: string): {
    parsed: Record<string, Record<string, string>>;
    notaGlobal?: string;
} {
    type ModelOutput = {
        nota_global?: string;
        tag_line?: string;
        translations?: Record<string, Record<string, unknown>>;
    };

    let json: ModelOutput;
    try {
        json = JSON.parse(raw) as ModelOutput;
    } catch {
        // Fallback: extract the first complete JSON object from the response
        // in case the model prepended or appended stray text.
        const match = raw.match(/\{[\s\S]*\}/);
        if (!match) {
            throw new Error(
                `Model output is not JSON. First 300 chars: ${raw.substring(0, 300)}`
            );
        }
        json = JSON.parse(match[0]) as ModelOutput;
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
    teaches?: string
): Promise<{ text: string; usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number } }> {
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
            max_tokens: maxTokensForBatch(batchLangs.length, includeNota),
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
            return callHaiku(chunkPt, contexto, batchLangs, batchName, includeNota, grammarFocus, teaches);
        }

        throw new Error(`Anthropic API ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
    };

    const text = data.content.find((c) => c.type === "text")?.text ?? "";

    console.log(
        `[GEN] ${batchName}: ${data.usage.input_tokens}in/${data.usage.output_tokens}out` +
        (data.usage.cache_read_input_tokens ? ` (${data.usage.cache_read_input_tokens} cached)` : "")
    );

    return {
        text,
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

    const { parsed, notaGlobal } = parseJSONOutput(result.text);

    if (notaGlobal) {
        console.log(`[GEN] ${batch.name}: notaGlobal extracted (${notaGlobal.length} chars)`);
    }

    // Verify all expected langs are present
    const missing = batch.langs.filter((l) => !parsed[l]);
    if (missing.length > 0) {
        console.warn(`[GEN] ${batch.name}: missing langs: ${missing.join(", ")}`);
    }

    return {
        batchName: batch.name,
        langs: batch.langs,
        raw: result.text,
        parsed,
        notaGlobal,
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
