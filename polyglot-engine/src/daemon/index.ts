import { PrismaClient } from "@prisma/client";
import { generateAllBatches } from "./generator";
import { assembleCard } from "./assembler";
import { getNextChunk, registerChunk, markChunkFailed } from "../lib/queue";
import { sendNotification } from "./notifier";
import { daemonState, calculateCost } from "./state";

const prisma = new PrismaClient();

const GENERATION_INTERVAL = parseInt(
    process.env.GENERATION_INTERVAL_MS ?? "120000",
    10
);

let running = true;

function shutdown(signal: string) {
    console.log(`[DAEMON] Received ${signal}. Shutting down gracefully...`);
    running = false;
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

function sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        const check = setInterval(() => {
            if (!running) {
                clearTimeout(timer);
                clearInterval(check);
                resolve();
            }
        }, 500);
    });
}

async function generateOne(): Promise<boolean> {
    const next = await getNextChunk();
    if (!next) {
        console.log("[DAEMON] No chunks available. Waiting...");
        return false;
    }

    const chunkPt = next.chunkPt;
    const contexto = next.contexto;
    const source = next.source;
    const chunkCategoria = next.categoria ?? "pedido";
    const chunkNivel = next.nivel ?? "a1";
    const grammarFocus = next.grammarFocus;
    const teaches = next.teaches;

    console.log(`[DAEMON] Generating: "${chunkPt}" (source: ${source})`);
    daemonState.currentState = "generating";
    daemonState.currentChunk = chunkPt;

    const jobStart = Date.now();

    // Create GenerationJob
    const job = await prisma.generationJob.create({
        data: {
            chunkPt,
            categoria: chunkCategoria as "pedido",
            nivel: chunkNivel as "a1",
            familyBatch: "all",
            status: "running",
        },
    });

    try {
        // Generate all 5 family batches
        const batches = await generateAllBatches(chunkPt, contexto, grammarFocus, teaches);

        // Persist GenerationBatch records for each batch
        let totalInput = 0;
        let totalOutput = 0;
        let totalCached = 0;
        let totalCost = 0;

        for (const batch of batches) {
            const cost = calculateCost(batch.usage);
            totalInput += batch.usage.input_tokens;
            totalOutput += batch.usage.output_tokens;
            totalCached += batch.usage.cache_read_input_tokens;
            totalCost += cost;

            await prisma.generationBatch.create({
                data: {
                    jobId: job.id,
                    family: batch.batchName,
                    status: "ok",
                    inputTokens: batch.usage.input_tokens,
                    outputTokens: batch.usage.output_tokens,
                    cachedTokens: batch.usage.cache_read_input_tokens,
                    costUsd: cost,
                    durationMs: batch.durationMs,
                    langsGenerated: Object.keys(batch.parsed),
                    rawResponse: batch.raw.substring(0, 5000),
                },
            });
        }

        const jobDurationMs = Date.now() - jobStart;

        // Update job with aggregate metrics
        await prisma.generationJob.update({
            where: { id: job.id },
            data: {
                inputTokens: totalInput,
                outputTokens: totalOutput,
                cachedTokens: totalCached,
                cost: totalCost,
                durationMs: jobDurationMs,
            },
        });

        // Assemble into card
        const result = await assembleCard(chunkPt, contexto, batches, job.id, teaches);

        // Update job with cardId
        if (result.cardId) {
            await prisma.generationJob.update({
                where: { id: job.id },
                data: { cardId: result.cardId },
            });
        }

        // Get pending count for notification
        const pendingCount = await prisma.chunkRegistry.count({ where: { gerado: false } });
        const card = result.cardId
            ? await prisma.card.findUnique({ where: { id: result.cardId }, select: { seq: true } })
            : null;
        const seqLabel = card ? `#${String(card.seq).padStart(3, "0")}` : "";
        const durationSec = (jobDurationMs / 1000).toFixed(1);
        const costLabel = `$${totalCost.toFixed(3)}`;
        const langsCount = Object.keys(batches.reduce((acc: Record<string, boolean>, b) => {
            for (const k of Object.keys(b.parsed)) acc[k] = true;
            return acc;
        }, {})).length;

        if (result.success) {
            await registerChunk(chunkPt, source);
            const msg = [
                `✅ ${seqLabel} "${chunkPt}"`,
                `⏱ ${durationSec}s | 💰 ${costLabel} | 🎯 QA: ${result.qaScore.toFixed(2)}`,
                `📊 5/5 batches OK | ${langsCount}/25 langs`,
                `📦 Fila: ${pendingCount} pendentes`,
            ].join("\n");
            console.log(`[DAEMON] ${msg}`);
            await sendNotification(msg);
            return true;
        } else if (result.quality === "suspicious") {
            await registerChunk(chunkPt, source);
            const msg = [
                `⚠️ ${seqLabel} "${chunkPt}"`,
                `⏱ ${durationSec}s | 💰 ${costLabel} | 🎯 QA: ${result.qaScore.toFixed(2)}`,
                `📊 5/5 batches OK | ${langsCount}/25 langs`,
                `⛳ Flags: ${result.flags.join(", ")}`,
            ].join("\n");
            console.log(`[DAEMON] ${msg}`);
            await sendNotification(msg);
            return true;
        } else {
            await markChunkFailed(chunkPt);
            const msg = [
                `❌ "${chunkPt}"`,
                `⏱ ${durationSec}s | 🎯 QA: ${result.qaScore.toFixed(2)}`,
                `🔴 ${result.error}`,
            ].join("\n");
            console.log(`[DAEMON] ${msg}`);
            await sendNotification(msg);
            return false;
        }
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const jobDurationMs = Date.now() - jobStart;
        console.error(`[DAEMON] Error generating "${chunkPt}":`, errMsg);

        // Detect Anthropic low-balance error and back off briefly
        const lowBalance = /credit balance.*low/i.test(errMsg) || /credit balance/i.test(errMsg);
        if (lowBalance) {
            const backoffMs = parseInt(process.env.LOW_BALANCE_BACKOFF_MS ?? "300000", 10); // default 5 min
            daemonState.nextTickAt = Date.now() + backoffMs;
            console.warn(`[DAEMON] Low balance detected. Backing off for ${Math.round(backoffMs / 1000)}s.`);
        }

        await prisma.generationJob.update({
            where: { id: job.id },
            data: { status: "failed", error: errMsg, durationMs: jobDurationMs },
        });
        await markChunkFailed(chunkPt);

        const durationSec = (jobDurationMs / 1000).toFixed(1);
        const msg = [
            `❌ "${chunkPt}"`,
            `⏱ ${durationSec}s`,
            `🔴 Erro: ${errMsg.substring(0, 200)}`,
        ].join("\n");
        await sendNotification(msg);
        return false;
    } finally {
        daemonState.currentState = "idle";
        daemonState.currentChunk = null;
    }
}

async function main() {
    console.log("[DAEMON] PolyGlot generation daemon started");
    daemonState.startedAt = Date.now();
    daemonState.intervalMs = GENERATION_INTERVAL;

    while (running) {
        const enabledEnv = process.env.GENERATION_ENABLED !== "false";
        const enabled = enabledEnv && daemonState.enabled;
        daemonState.enabled = enabled;

        if (!enabled) {
            daemonState.currentState = "paused";
            console.log("[DAEMON] Generation disabled/paused. Idling...");
            daemonState.nextTickAt = Date.now() + GENERATION_INTERVAL;
            await sleep(GENERATION_INTERVAL);
            continue;
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.log("[DAEMON] No ANTHROPIC_API_KEY set. Idling...");
            daemonState.nextTickAt = Date.now() + GENERATION_INTERVAL;
            await sleep(GENERATION_INTERVAL);
            continue;
        }

        daemonState.lastTickAt = Date.now();
        await generateOne();
        daemonState.nextTickAt = Date.now() + GENERATION_INTERVAL;
        await sleep(GENERATION_INTERVAL);
    }

    await prisma.$disconnect();
    console.log("[DAEMON] Daemon stopped.");
    process.exit(0);
}

main().catch((err) => {
    console.error("[DAEMON] Fatal error:", err);
    process.exit(1);
});
