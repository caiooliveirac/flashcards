/**
 * enrich-insights.ts — Enriquece cards com insights cross-linguísticos via Opus
 *
 * Lê cards do DB, envia para Opus com prompt cacheável, parseia a resposta
 * com segurança, grava no DB, e notifica via Telegram.
 *
 * Uso:
 *   npx tsx scripts/enrich-insights.ts                    # processa todos sem insight
 *   npx tsx scripts/enrich-insights.ts --limit=5          # processa 5 cards
 *   npx tsx scripts/enrich-insights.ts --card=<id>        # 1 card específico
 *   npx tsx scripts/enrich-insights.ts --dry              # não grava, só mostra
 *   npx tsx scripts/enrich-insights.ts --card=<id> --dry  # testa 1 card sem gravar
 *
 * Logs: stdout estruturado + logs/enrich-insights.log
 */

import { PrismaClient } from "@prisma/client";
import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";

// ─── CONFIG ──────────────────────────────────────────────────────────────

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");
const LIMIT = parseInt(process.argv.find(a => a.startsWith("--limit="))?.replace("--limit=", "") ?? "0", 10);
const CARD_ID = process.argv.find(a => a.startsWith("--card="))?.replace("--card=", "");
const MODEL = "claude-opus-4-6";
const MAX_TOKENS = 8192;
const DELAY_MS = 2000; // between cards to avoid rate limits

const TELEGRAM_API = "https://api.telegram.org";
const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "enrich-insights.log");

// ─── SYSTEM PROMPT (cacheável) ───────────────────────────────────────────

const INSIGHT_PROMPT = (() => {
    const paths = [
        join(process.cwd(), "data", "insight-prompt.txt"),
        join(process.cwd(), "src", "data", "insight-prompt.txt"),
    ];
    for (const p of paths) {
        try { return readFileSync(p, "utf-8"); } catch { /* next */ }
    }
    throw new Error("insight-prompt.txt not found");
})();

// ─── LOGGING ─────────────────────────────────────────────────────────────

function ensureLogDir() {
    try { mkdirSync(LOG_DIR, { recursive: true }); } catch { /* exists */ }
}

function log(level: "INFO" | "WARN" | "ERROR" | "OK", msg: string, data?: Record<string, unknown>) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${msg}${data ? " " + JSON.stringify(data) : ""}`;
    console.log(line);
    try { appendFileSync(LOG_FILE, line + "\n"); } catch { /* ignore */ }
}

// ─── TELEGRAM ────────────────────────────────────────────────────────────

async function notify(message: string) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;
    try {
        await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                parse_mode: "HTML",
                disable_web_page_preview: true,
            }),
        });
    } catch (err) {
        log("WARN", "Telegram notification failed", { error: String(err) });
    }
}

// ─── OPUS API ────────────────────────────────────────────────────────────

interface OpusResponse {
    nota_global: string;
    lang_insights: Record<string, string | null>;
}

async function callOpus(userPrompt: string): Promise<{
    raw: string;
    usage: { input_tokens: number; output_tokens: number; cache_read: number; cache_create: number };
    durationMs: number;
}> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const start = Date.now();

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            temperature: 0.3,
            system: [
                {
                    type: "text",
                    text: INSIGHT_PROMPT,
                    cache_control: { type: "ephemeral" },
                },
            ],
            messages: [{ role: "user", content: userPrompt }],
        }),
    });

    const durationMs = Date.now() - start;

    if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("retry-after") ?? "60", 10);
            log("WARN", `Rate limited, waiting ${retryAfter}s...`);
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            return callOpus(userPrompt); // retry once
        }
        throw new Error(`Opus API ${response.status}: ${errBody.slice(0, 500)}`);
    }

    const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
        stop_reason: string;
        usage: {
            input_tokens: number;
            output_tokens: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
        };
    };

    const raw = data.content.find(c => c.type === "text")?.text ?? "";

    return {
        raw,
        usage: {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens,
            cache_read: data.usage.cache_read_input_tokens ?? 0,
            cache_create: data.usage.cache_creation_input_tokens ?? 0,
        },
        durationMs,
    };
}

// ─── PARSING (safe, separate from API call) ──────────────────────────────

function parseInsightResponse(raw: string): OpusResponse {
    // Strip markdown fences if present
    let text = raw.trim();
    // Handle ```json ... ``` (complete fences)
    const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n\s*```/);
    if (fenced) {
        text = fenced[1].trim();
    } else {
        // Handle opening fence without closing (truncated or just style)
        const openOnly = text.match(/```(?:json)?\s*\n([\s\S]*)/);
        if (openOnly) text = openOnly[1].trim();
    }

    // Remove trailing commas
    text = text.replace(/,(\s*[}\]])/g, "$1");

    let parsed: OpusResponse;
    try {
        parsed = JSON.parse(text) as OpusResponse;
    } catch (err) {
        // Try extracting JSON object
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                parsed = JSON.parse(match[0]) as OpusResponse;
                log("WARN", "JSON parsed via regex extraction");
            } catch {
                throw new Error(`JSON parse failed: ${String(err)}. Raw[0:300]: ${raw.slice(0, 300)}`);
            }
        } else {
            throw new Error(`No JSON object found. Raw[0:300]: ${raw.slice(0, 300)}`);
        }
    }

    // Validate structure
    if (typeof parsed.nota_global !== "string") {
        throw new Error("Missing or invalid nota_global field");
    }
    if (typeof parsed.lang_insights !== "object" || parsed.lang_insights === null) {
        throw new Error("Missing or invalid lang_insights field");
    }

    return parsed;
}

// ─── BUILD USER PROMPT ───────────────────────────────────────────────────

function buildUserPrompt(card: {
    frentePt: string;
    contexto: string;
    objetivo: string;
    notaGlobal: string;
    blocos: Array<{
        langCode: string;
        natural: string;
        romanizacao: string;
        variacaoNativa: string | null;
        literal: string;
        gramatica: string | null;
        obs: string;
        erroTipico: string;
        contraste: string;
        armadilha: string;
        sinonimos: string | null;
        collocations: string | null;
        campoSemantico: string | null;
        registroVariacoes: string | null;
    }>;
}): string {
    const blocosText = card.blocos.map(b => {
        const lines = [
            `[${b.langCode}]`,
            `  natural: ${b.natural}`,
        ];
        if (b.romanizacao && b.romanizacao !== "—") lines.push(`  romanização: ${b.romanizacao}`);
        if (b.variacaoNativa) lines.push(`  coloquial: ${b.variacaoNativa}`);
        lines.push(`  literal: ${b.literal}`);
        if (b.gramatica) lines.push(`  gramática: ${b.gramatica}`);
        lines.push(`  obs: ${b.obs}`);
        lines.push(`  erro típico: ${b.erroTipico}`);
        lines.push(`  contraste: ${b.contraste}`);
        lines.push(`  armadilha: ${b.armadilha}`);
        if (b.sinonimos) lines.push(`  sinônimos: ${b.sinonimos}`);
        if (b.collocations) lines.push(`  collocations: ${b.collocations}`);
        if (b.campoSemantico) lines.push(`  campo semântico: ${b.campoSemantico}`);
        if (b.registroVariacoes) lines.push(`  variações de registro: ${b.registroVariacoes}`);
        return lines.join("\n");
    }).join("\n\n");

    return `FRASE: "${card.frentePt}"
CONTEXTO: ${card.contexto}
OBJETIVO: ${card.objetivo}

NOTA GLOBAL ATUAL (a ser substituída):
${card.notaGlobal.slice(0, 500)}

BLOCOS DE IDIOMA:
${blocosText}`;
}

// ─── MAIN ────────────────────────────────────────────────────────────────

async function main() {
    ensureLogDir();
    log("INFO", "=== enrich-insights.ts started ===", { DRY, LIMIT, CARD_ID, MODEL });

    // Query cards that need enrichment
    const where = CARD_ID
        ? { id: CARD_ID }
        : {
            blocos: {
                every: { insight: null },
            },
        };

    const cards = await p.card.findMany({
        where,
        include: {
            blocos: {
                select: {
                    id: true,
                    langCode: true,
                    natural: true,
                    romanizacao: true,
                    variacaoNativa: true,
                    literal: true,
                    gramatica: true,
                    obs: true,
                    erroTipico: true,
                    contraste: true,
                    armadilha: true,
                    sinonimos: true,
                    collocations: true,
                    campoSemantico: true,
                    registroVariacoes: true,
                    insight: true,
                },
            },
        },
        orderBy: { seq: "asc" },
        take: LIMIT > 0 ? LIMIT : undefined,
    });

    log("INFO", `Found ${cards.length} cards to enrich`);

    if (cards.length === 0) {
        log("INFO", "Nothing to do. Exiting.");
        await p.$disconnect();
        return;
    }

    let successCount = 0;
    let errorCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    const errors: Array<{ seq: number; error: string }> = [];

    for (const card of cards) {
        const label = `#${card.seq} "${card.frentePt.slice(0, 50)}"`;
        log("INFO", `Processing ${label}`);

        try {
            // Step 1: Build prompt
            const userPrompt = buildUserPrompt({
                frentePt: card.frentePt,
                contexto: card.contexto,
                objetivo: card.objetivo,
                notaGlobal: card.notaGlobal,
                blocos: card.blocos,
            });

            if (DRY) {
                log("INFO", `[DRY] Would send prompt (${userPrompt.length} chars) for ${label}`);
                log("INFO", `[DRY] Prompt preview:\n${userPrompt.slice(0, 500)}...`);
                successCount++;
                continue;
            }

            // Step 2: Call Opus
            const { raw, usage, durationMs } = await callOpus(userPrompt);
            totalInputTokens += usage.input_tokens;
            totalOutputTokens += usage.output_tokens;
            totalCacheRead += usage.cache_read;

            log("INFO", `Opus response for ${label}`, {
                in: usage.input_tokens,
                out: usage.output_tokens,
                cached: usage.cache_read,
                ms: durationMs,
            });

            // Step 3: Parse response (safe, separate)
            let parsed: OpusResponse;
            try {
                parsed = parseInsightResponse(raw);
            } catch (parseErr) {
                // Save raw to log for debugging, don't crash
                log("ERROR", `Parse failed for ${label}: ${String(parseErr)}`);
                log("ERROR", `Raw response saved. Length: ${raw.length}`);
                appendFileSync(
                    join(LOG_DIR, `insight-raw-error-seq${card.seq}.txt`),
                    `=== ${new Date().toISOString()} ===\n${raw}\n\n`
                );
                errors.push({ seq: card.seq, error: String(parseErr) });
                errorCount++;
                continue;
            }

            // Step 4: Validate lang_insights match existing blocos
            const cardLangs = card.blocos.map(b => b.langCode);
            const insightLangs = Object.keys(parsed.lang_insights);
            const extraLangs = insightLangs.filter(l => !cardLangs.includes(l));
            if (extraLangs.length > 0) {
                log("WARN", `${label}: Opus returned insights for langs not in card: ${extraLangs.join(",")}`);
            }

            // Step 5: Write to DB
            const updates: Promise<unknown>[] = [];

            // Update notaGlobal + mark as enriched
            updates.push(
                p.card.update({
                    where: { id: card.id },
                    data: {
                        notaGlobal: parsed.nota_global,
                        quality: "enriched",
                        // Set idiomasPrincipais to langs that have insights
                        idiomasPrincipais: cardLangs.filter(lc =>
                            parsed.lang_insights[lc] != null &&
                            typeof parsed.lang_insights[lc] === "string" &&
                            (parsed.lang_insights[lc] as string).length > 0
                        ),
                    },
                })
            );

            // Update per-bloco insights
            for (const bloco of card.blocos) {
                const insightText = parsed.lang_insights[bloco.langCode];
                updates.push(
                    p.langBloco.update({
                        where: { id: bloco.id },
                        data: {
                            insight: insightText ?? null,
                        },
                    })
                );
            }

            await Promise.all(updates);

            const insightCount = cardLangs.filter(l => parsed.lang_insights[l] != null).length;
            log("OK", `${label}: notaGlobal updated + ${insightCount}/${cardLangs.length} lang insights saved`);
            successCount++;

            // Delay between cards
            if (cards.indexOf(card) < cards.length - 1) {
                await new Promise(r => setTimeout(r, DELAY_MS));
            }

        } catch (err) {
            log("ERROR", `Failed ${label}: ${String(err)}`);
            errors.push({ seq: card.seq, error: String(err) });
            errorCount++;
        }
    }

    // ─── SUMMARY ─────────────────────────────────────────────────────────

    const costIn = (totalInputTokens / 1_000_000) * 15;  // Opus input: $15/M
    const costOut = (totalOutputTokens / 1_000_000) * 75; // Opus output: $75/M
    const costCacheRead = (totalCacheRead / 1_000_000) * 1.5; // cached read: $1.50/M
    const totalCost = costIn + costOut - (totalCacheRead > 0 ? (totalCacheRead / 1_000_000) * 13.5 : 0);
    // Cache savings: instead of $15/M input, cached reads are $1.50/M (save $13.50/M)

    const summary = [
        `\n${"=".repeat(60)}`,
        `ENRICH-INSIGHTS SUMMARY`,
        `${"=".repeat(60)}`,
        `Cards processed: ${cards.length}`,
        `Success: ${successCount}`,
        `Errors: ${errorCount}`,
        `Tokens — in: ${totalInputTokens.toLocaleString()} | out: ${totalOutputTokens.toLocaleString()} | cached: ${totalCacheRead.toLocaleString()}`,
        `Cost estimate: $${totalCost.toFixed(3)}`,
        ...(errors.length > 0 ? [`Errors:\n${errors.map(e => `  #${e.seq}: ${e.error.slice(0, 100)}`).join("\n")}`] : []),
        `${"=".repeat(60)}`,
    ].join("\n");

    log("INFO", summary);

    // Telegram summary
    const tgMsg = [
        `🧠 <b>Enrich Insights</b> ${DRY ? "(DRY RUN)" : ""}`,
        ``,
        `✅ ${successCount} cards enriquecidos`,
        errorCount > 0 ? `❌ ${errorCount} erros` : "",
        `💰 ~$${totalCost.toFixed(3)} (${totalCacheRead > 0 ? `${Math.round(totalCacheRead * 100 / totalInputTokens)}% cache hit` : "sem cache"})`,
        `📊 ${totalInputTokens.toLocaleString()}in / ${totalOutputTokens.toLocaleString()}out`,
        ...(errors.length > 0 ? errors.slice(0, 3).map(e => `⚠️ #${e.seq}: ${e.error.slice(0, 80)}`) : []),
    ].filter(Boolean).join("\n");

    await notify(tgMsg);

    await p.$disconnect();
    log("INFO", "Done.");
}

main().catch(async (err) => {
    log("ERROR", `Fatal: ${String(err)}`);
    await notify(`🔴 <b>enrich-insights FATAL</b>\n${String(err).slice(0, 200)}`);
    await p.$disconnect();
    process.exit(1);
});
