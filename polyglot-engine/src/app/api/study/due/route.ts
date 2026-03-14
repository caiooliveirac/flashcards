import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import { TIER_SRS_WEIGHT } from "@/lib/tiers";
import { getTier } from "@/lib/tiers";
import type { LangCode } from "@/lib/types";
import { LANG_CODES } from "@/lib/types";

export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const lang = url.searchParams.get("lang");
    const tier = url.searchParams.get("tier");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
    const now = new Date();

    // Build where clause for reviews
    const where: Record<string, unknown> = {
        due: { lte: now },
    };

    if (lang) {
        where.langCode = lang;
    }

    if (tier) {
        const tierKey = `Tier ${tier.toUpperCase()}` as keyof typeof TIER_SRS_WEIGHT;
        const tierLangs = getTierLangs(tierKey);
        if (tierLangs.length > 0) {
            where.langCode = { in: tierLangs };
        }
    }

    const dueReviews = await prisma.review.findMany({
        where,
        include: {
            card: {
                include: {
                    blocos: true,
                    difficulties: true,
                    tags: { include: { tag: true } },
                },
            },
        },
        orderBy: { due: "asc" },
        take: limit,
    });

    // Also find cards with NO reviews (new cards)
    const reviewedCardIds = dueReviews.map((r) => r.cardId);
    const newCards = await prisma.card.findMany({
        where: {
            id: { notIn: reviewedCardIds },
            ...(lang ? { blocos: { some: { langCode: lang } } } : {}),
        },
        include: {
            blocos: true,
            difficulties: true,
            tags: { include: { tag: true } },
        },
        take: Math.max(0, limit - dueReviews.length),
    });

    // Shuffle new cards so users don't get them in strict seq order
    const shuffledNew = [...newCards].sort(() => Math.random() - 0.5);

    // Weight and lightly randomize due reviews to avoid fixed order
    const nowMs = now.getTime();
    const weighted = dueReviews.map((r) => {
        const langCode = r.langCode ?? "DE";
        let weight = 1.0;
        try {
            const t = getTier(langCode as LangCode);
            weight = TIER_SRS_WEIGHT[t];
        } catch {
            /* unknown lang, default weight */
        }

        // Add jitter: more overdue → slightly more priority, plus randomness
        const overdueDays = Math.max(0, (nowMs - r.due.getTime()) / 86_400_000);
        const priority = weight * (1 + overdueDays) + Math.random() * 0.4;
        return { ...r, priority };
    });

    weighted.sort((a, b) => b.priority - a.priority);

    return NextResponse.json({
        due: weighted,
        new: shuffledNew,
        total: weighted.length + shuffledNew.length,
    });
}

function getTierLangs(tier: string): string[] {
    const tierMap: Record<string, readonly string[]> = {
        "Tier S": ["DE", "EN", "FR", "IT", "ES"],
        "Tier A": ["JA", "KO", "ZH", "RU", "AR"],
        "Tier B": ["SV", "NO", "NL", "DA", "FI"],
        "Tier C": ["BCS", "HU", "CS", "PL", "TR"],
        "Tier D": ["TH", "VI", "HE", "EL", "ID"],
    };
    return [...(tierMap[tier] ?? LANG_CODES)];
}
