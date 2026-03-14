import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const status = url.searchParams.get("status");

    const where: Record<string, unknown> = {};

    if (status) {
        if (status === "suspicious") {
            // Suspicious = done but qaScore <= 0.7
            where.status = "done";
            where.qaScore = { lte: 0.7 };
        } else {
            where.status = status;
        }
    }

    const [jobs, total] = await Promise.all([
        prisma.generationJob.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                batches: true,
            },
        }),
        prisma.generationJob.count({ where }),
    ]);

    return NextResponse.json({
        jobs: jobs.map(j => ({
            id: j.id,
            chunkPt: j.chunkPt,
            status: j.status,
            createdAt: j.createdAt,
            completedAt: j.completedAt,
            duration_ms: j.durationMs,
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
            qa: j.qaScore !== null ? {
                score: j.qaScore,
                passed: (j.qaScore ?? 0) > 0.7,
                flags: j.qaFlags,
                checks: j.qaChecks as { checks: { name: string; passed: boolean; detail: string }[] } | null,
            } : null,
            card_id: j.cardId,
        })),
        total,
        page,
        limit,
    });
}
