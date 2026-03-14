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

function parseBatchOutput(raw: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    const blocks = raw.split("||").map((b) => b.trim()).filter(Boolean);

    for (const block of blocks) {
        const fields: Record<string, string> = {};
        const pairs = block.split("|").map((p) => p.trim());

        for (const pair of pairs) {
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) continue;
            const key = pair.substring(0, eqIdx).trim();
            const value = pair.substring(eqIdx + 1).trim();
            fields[key] = value;
        }

        if (fields.langCode) {
            result[fields.langCode] = fields;
        }
    }

    return result;
}

/** Estimate max output tokens needed based on batch size */
function maxTokensForBatch(langCount: number, includeNota: boolean): number {
    // Measured: ~420 tokens/lang avg output. Use 500/lang + buffer.
    // notaGlobal adds ~400-600 tokens
    const notaTokens = includeNota ? 600 : 0;
    return Math.min(7000, Math.ceil(langCount * 500 * 1.3) + notaTokens);
}

/** Separate NOTA_GLOBAL section from TSV blocks */
function extractNotaGlobal(raw: string): { nota: string; tsv: string } {
    const separator = "===";
    const idx = raw.indexOf(separator);
    if (idx === -1) return { nota: "", tsv: raw };

    const before = raw.substring(0, idx).trim();
    const after = raw.substring(idx + separator.length).trim();

    const notaPrefix = "NOTA_GLOBAL=";
    const nota = before.startsWith(notaPrefix)
        ? before.substring(notaPrefix.length).trim()
        : before;

    return { nota, tsv: after };
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

    let notaGlobal: string | undefined;
    let tsvText = result.text;

    if (includeNota) {
        const extracted = extractNotaGlobal(result.text);
        notaGlobal = extracted.nota || undefined;
        tsvText = extracted.tsv;
        if (notaGlobal) {
            console.log(`[GEN] ${batch.name}: notaGlobal extracted (${notaGlobal.length} chars)`);
        }
    }

    const parsed = parseBatchOutput(tsvText);

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
    // Run all batches in parallel — shares prompt cache across calls
    // Batch 0 (romance_germanic) also generates the notaGlobal
    const promises = GENERATION_BATCHES.map((_, i) =>
        generateBatch(chunkPt, contexto, i, i === 0, grammarFocus, teaches)
    );
    return Promise.all(promises);
}
