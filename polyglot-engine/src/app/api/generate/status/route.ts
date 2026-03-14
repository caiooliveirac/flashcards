import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [
        todayJobs,
        allTimeCards,
        qualityCounts,
        pendingChunks,
        generatedChunks,
        failedChunks,
        last5Jobs,
        todayCostAgg,
    ] = await Promise.all([
        prisma.generationJob.findMany({
            where: { createdAt: { gte: todayStart } },
            include: { batches: true },
        }),
        prisma.card.count(),
        prisma.card.groupBy({ by: ["quality"], _count: true }),
        prisma.chunkRegistry.count({ where: { gerado: false } }),
        prisma.chunkRegistry.count({ where: { gerado: true } }),
        prisma.generationJob.count({ where: { status: "failed" } }),
        prisma.generationJob.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: {
                batches: true,
            },
        }),
        prisma.generationJob.aggregate({
            where: { createdAt: { gte: todayStart }, status: "done" },
            _sum: { cost: true, inputTokens: true, outputTokens: true, cachedTokens: true },
            _avg: { qaScore: true },
            _count: true,
        }),
    ]);

    // Today stats
    const todayDone = todayJobs.filter(j => j.status === "done");
    const todaySuspicious = todayJobs.filter(j => j.status === "done" && j.qaScore !== null && j.qaScore <= 0.7);
    const todayFailed = todayJobs.filter(j => j.status === "failed");

    // Quality breakdown
    const byQuality: Record<string, number> = {};
    for (const q of qualityCounts) {
        byQuality[q.quality] = q._count;
    }

    // All-time cost
    const allTimeCost = await prisma.generationJob.aggregate({
        where: { status: "done" },
        _sum: { cost: true },
    });

    // Variation count estimate (7 strategies * generated chunks)
    const variationsAvailable = generatedChunks * 7;

    const enabled = process.env.GENERATION_ENABLED !== "false";
    const intervalMs = parseInt(process.env.GENERATION_INTERVAL_MS ?? "120000", 10);

    // We can't directly know daemon uptime from Next.js process, but we can approximate
    // by finding the earliest running/done job timestamp
    const firstJob = await prisma.generationJob.findFirst({
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
    });

    return NextResponse.json({
        daemon: {
            enabled,
            interval_ms: intervalMs,
            current_state: enabled ? "idle" : "paused",
            last_tick_at: last5Jobs[0]?.createdAt ?? null,
            next_tick_at: last5Jobs[0]
                ? new Date(new Date(last5Jobs[0].createdAt).getTime() + intervalMs).toISOString()
                : null,
        },
        queue: {
            total_chunks: pendingChunks + generatedChunks,
            pending: pendingChunks,
            generated: generatedChunks,
            failed: failedChunks,
            variations_available: variationsAvailable,
        },
        generation: {
            today: {
                total: todayJobs.length,
                success: todayDone.length - todaySuspicious.length,
                suspicious: todaySuspicious.length,
                failed: todayFailed.length,
                avg_qa_score: todayCostAgg._avg.qaScore ?? 0,
                total_cost_usd: todayCostAgg._sum.cost ?? 0,
                total_input_tokens: todayCostAgg._sum.inputTokens ?? 0,
                total_output_tokens: todayCostAgg._sum.outputTokens ?? 0,
                total_cached_tokens: todayCostAgg._sum.cachedTokens ?? 0,
            },
            all_time: {
                total_cards: allTimeCards,
                by_quality: byQuality,
                total_cost_usd: allTimeCost._sum.cost ?? 0,
            },
        },
        last_5_jobs: last5Jobs.map(j => ({
            id: j.id,
            chunkPt: j.chunkPt,
            status: j.status,
            createdAt: j.createdAt,
            completedAt: j.completedAt,
            duration_ms: j.durationMs,
            qaScore: j.qaScore,
            qaFlags: j.qaFlags,
            cost: j.cost,
            cardId: j.cardId,
            batches: j.batches.map(b => ({
                family: b.family,
                status: b.status,
                input_tokens: b.inputTokens,
                output_tokens: b.outputTokens,
                cached_tokens: b.cachedTokens,
                cost_usd: b.costUsd,
                duration_ms: b.durationMs,
                langs_generated: b.langsGenerated,
                error: b.error,
            })),
        })),
    });
}
