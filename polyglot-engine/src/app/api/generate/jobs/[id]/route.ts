import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const job = await prisma.generationJob.findUnique({
        where: { id: params.id },
        include: { batches: true },
    });

    if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // If there's a card, get it with blocos for preview
    let card = null;
    if (job.cardId) {
        card = await prisma.card.findUnique({
            where: { id: job.cardId },
            include: {
                blocos: true,
                tags: { include: { tag: true } },
            },
        });
    }

    return NextResponse.json({
        id: job.id,
        chunkPt: job.chunkPt,
        categoria: job.categoria,
        nivel: job.nivel,
        status: job.status,
        rawTsv: job.rawTsv,
        error: job.error,
        model: job.model,
        promptVersion: job.promptVersion,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
        duration_ms: job.durationMs,
        cost: job.cost,
        inputTokens: job.inputTokens,
        outputTokens: job.outputTokens,
        cachedTokens: job.cachedTokens,
        batches: job.batches.map(b => ({
            id: b.id,
            family: b.family,
            status: b.status,
            input_tokens: b.inputTokens,
            output_tokens: b.outputTokens,
            cached_tokens: b.cachedTokens,
            cost_usd: b.costUsd,
            duration_ms: b.durationMs,
            langs_generated: b.langsGenerated,
            rawResponse: b.rawResponse,
            error: b.error,
        })),
        qa: job.qaScore !== null ? {
            score: job.qaScore,
            passed: (job.qaScore ?? 0) > 0.7,
            flags: job.qaFlags,
            checks: job.qaChecks,
        } : null,
        card_id: job.cardId,
        card,
    });
}
