/**
 * Reconstruct missing notaGlobal for cards that have an empty string.
 * Calls Haiku requesting only 3 romance languages (minimal token cost),
 * with NOTA:yes so it generates the nota_global field.
 * Runs sequentially with a 5s delay between calls to stay under rate limits.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { join } from "path";

const p = new PrismaClient();

const SYSTEM_PROMPT = (() => {
    const paths = [
        join(process.cwd(), "data", "system-prompt.txt"),
        join(__dirname, "..", "src", "data", "system-prompt.txt"),
        join(process.cwd(), "src", "data", "system-prompt.txt"),
    ];
    for (const path of paths) {
        try { return readFileSync(path, "utf-8"); } catch { /* try next */ }
    }
    throw new Error("system-prompt.txt not found");
})();

// Ask for 3 small langs just so the model produces valid JSON with translations;
// we only care about nota_global.
const PROBE_LANGS = ["FR", "ES", "IT"];

async function generateNota(frentePt: string, contexto: string): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const userPrompt = `CHUNK: "${frentePt}"
CTX: ${contexto}
LANGS: ${PROBE_LANGS.join(",")}
NOTA: yes`;

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
            max_tokens: 4096,
            temperature: 0,
            system: [
                { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
            ],
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Anthropic API ${response.status}: ${body.substring(0, 200)}`);
    }

    const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
    };

    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    const cached = data.usage.cache_read_input_tokens ?? 0;
    console.log(`    tokens: ${data.usage.input_tokens}in/${data.usage.output_tokens}out (${cached} cached)`);

    // Parse JSON — strip markdown fences if present (truncated or not)
    let cleaned = text;
    const fenced = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (fenced) { cleaned = fenced[1].trim(); }
    else { const openOnly = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*)/); if (openOnly) cleaned = openOnly[1].trim(); }

    let json: { nota_global?: string };
    try {
        json = JSON.parse(cleaned);
    } catch {
        // Step 1: fix unescaped control chars inside strings
        let fixed = "";
        let inStr = false;
        for (let i = 0; i < cleaned.length; i++) {
            const ch = cleaned[i];
            if (inStr) {
                if (ch === "\\" && i + 1 < cleaned.length) { fixed += ch + cleaned[++i]; continue; }
                if (ch === "\"") {
                    const rest = cleaned.substring(i + 1).trimStart();
                    if (!rest.length || rest[0] === "," || rest[0] === "}" || rest[0] === "]" || rest[0] === ":") {
                        fixed += ch; inStr = false;
                    } else { fixed += "\\\""; }
                    continue;
                }
                if (ch === "\n") { fixed += "\\n"; continue; }
                if (ch === "\r") { fixed += "\\r"; continue; }
                if (ch === "\t") { fixed += "\\t"; continue; }
                fixed += ch;
            } else {
                if (ch === "\"") inStr = true;
                fixed += ch;
            }
        }
        // Step 2: remove trailing commas
        fixed = fixed.replace(/,(?:\s*[}\]])/g, (m) => m.replace(",", ""));
        // Step 3: close open braces if truncated
        const opens: string[] = [];
        let s = false;
        for (let i = 0; i < fixed.length; i++) {
            const c = fixed[i];
            if (s) { if (c === "\\" && i + 1 < fixed.length) { i++; } else if (c === "\"") s = false; }
            else if (c === "\"") s = true;
            else if (c === "{") opens.push("}");
            else if (c === "[") opens.push("]");
            else if (c === "}" || c === "]") opens.pop();
        }
        // trim partial last key/value
        let trimmed = fixed.replace(/,?\s*"[^"]*$/, "").replace(/,?\s*"[^"]*":\s*$/, "");
        trimmed += opens.reverse().join("");
        json = JSON.parse(trimmed);
    }

    const nota = (json.nota_global ?? "").trim();
    if (!nota) throw new Error("nota_global empty in API response");
    return nota;
}

async function main() {
    const cards = await p.card.findMany({
        where: { notaGlobal: "" },
        orderBy: { seq: "asc" },
        select: { id: true, seq: true, frentePt: true, contexto: true },
    });

    console.log(`Found ${cards.length} cards missing notaGlobal. Reconstructing...`);
    console.log("(Each call uses ~3 romance langs only — minimal cost)\n");

    let ok = 0;
    let failed = 0;

    for (const card of cards) {
        console.log(`[${ok + failed + 1}/${cards.length}] seq=${card.seq}: "${card.frentePt}"`);
        try {
            const nota = await generateNota(card.frentePt, card.contexto);
            await p.card.update({
                where: { id: card.id },
                data: { notaGlobal: nota },
            });
            console.log(`    OK (${nota.length} chars): ${nota.substring(0, 80)}...`);
            ok++;
        } catch (err) {
            console.error(`    FAILED: ${err instanceof Error ? err.message : String(err)}`);
            failed++;
        }

        // Rate limit gap: each call produces ~3500 output tokens; limit is 10k/min
        // So max ~2 calls/min → wait 32s between calls
        if (ok + failed < cards.length) {
            await new Promise((r) => setTimeout(r, 32000));
        }
    }

    console.log(`\nDone: ${ok} updated, ${failed} failed`);
    await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
