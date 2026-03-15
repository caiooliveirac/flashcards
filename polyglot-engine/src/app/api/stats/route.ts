import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now);
    monthStart.setDate(1);

    const [
        totalCards,
        qualityBreakdown,
        categoryBreakdown,
        levelBreakdown,
        reviewsToday,
        dueNow,
        todayGenerated,
        weekGenerated,
        monthGenerated,
        monthCost,
        difficulties,
    ] = await Promise.all([
        prisma.card.count(),
        prisma.card.groupBy({ by: ["quality"], _count: true }),
        prisma.card.groupBy({ by: ["categoria"], _count: true }),
        prisma.card.groupBy({ by: ["nivel"], _count: true }),
        prisma.review.count({
            where: { reviewedAt: { gte: todayStart } },
        }),
        prisma.review.count({
            where: { due: { lte: now } },
        }),
        prisma.generationJob.count({
            where: { createdAt: { gte: todayStart }, status: "done" },
        }),
        prisma.generationJob.count({
            where: { createdAt: { gte: weekStart }, status: "done" },
        }),
        prisma.generationJob.count({
            where: { createdAt: { gte: monthStart }, status: "done" },
        }),
        prisma.generationJob.aggregate({
            where: { createdAt: { gte: monthStart }, status: "done" },
            _sum: { cost: true },
        }),
        prisma.langDifficulty.groupBy({
            by: ["langCode", "level"],
            _count: true,
        }),
    ]);

    // Build tier breakdown stats
    const tierMap: Record<string, string[]> = {
        "Tier S": ["DE", "EN", "FR", "IT", "ES"],
        "Tier A": ["JA", "KO", "ZH", "RU", "AR"],
        "Tier B": ["SV", "NO", "NL", "DA", "FI"],
        "Tier C": ["BCS", "HU", "CS", "PL", "TR"],
        "Tier D": ["TH", "VI", "HE", "EL", "ID"],
    };

    const byTier: Record<string, { total: number; due: number; reviewed_today: number }> = {};
    for (const [tier, langs] of Object.entries(tierMap)) {
        const [tierTotal, tierDue, tierReviewed] = await Promise.all([
            prisma.langBloco.count({ where: { langCode: { in: langs } } }),
            prisma.review.count({ where: { langCode: { in: langs }, due: { lte: now } } }),
            prisma.review.count({ where: { langCode: { in: langs }, reviewedAt: { gte: todayStart } } }),
        ]);
        byTier[tier] = { total: tierTotal, due: tierDue, reviewed_today: tierReviewed };
    }

    // Build quality map
    const byQuality: Record<string, number> = {};
    for (const q of qualityBreakdown) byQuality[q.quality] = q._count;

    const byCategoria: Record<string, number> = {};
    for (const c of categoryBreakdown) byCategoria[c.categoria] = c._count;

    const byNivel: Record<string, number> = {};
    for (const n of levelBreakdown) byNivel[n.nivel] = n._count;

    // Difficulty heatmap
    const difficultyHeatmap = difficulties.map(d => {
        const total = difficulties.filter(dd => dd.langCode === d.langCode).reduce((s, dd) => s + dd._count, 0);
        return {
            langCode: d.langCode,
            type: d.level,
            count: d._count,
            pct_hard: total > 0 ? d.level === "hard" ? (d._count / total) * 100 : 0 : 0,
        };
    });

    return NextResponse.json({
        // Fields the frontend currently reads
        totalCards: totalCards,
        reviewsToday: reviewsToday,
        dueNow: dueNow,
        qualityBreakdown: qualityBreakdown.map(q => ({ quality: q.quality, _count: q._count })),
        categoryBreakdown: categoryBreakdown.map(c => ({ categoria: c.categoria, _count: c._count })),
        levelBreakdown: levelBreakdown.map(n => ({ nivel: n.nivel, _count: n._count })),

        // Extra data for enriched stats view
        byTier: byTier,
        generation: {
            today: todayGenerated,
            week: weekGenerated,
            month: monthGenerated,
            costMonth: monthCost._sum.cost ?? 0,
        },
        difficultyHeatmap: difficultyHeatmap,
    });
}
