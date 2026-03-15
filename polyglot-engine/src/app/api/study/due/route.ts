import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
import { TIER_SRS_WEIGHT } from "@/lib/tiers";
import { getTier } from "@/lib/tiers";
import type { LangCode } from "@/lib/types";
import { LANG_CODES } from "@/lib/types";
import type { CardQuality } from "@prisma/client";

const VALID_QUALITIES = new Set(["raw", "reviewed", "edited", "gold", "enriched", "deprecated", "suspicious"]);

export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const lang = url.searchParams.get("lang");
    const tier = url.searchParams.get("tier");
    const quality = url.searchParams.get("quality");
    const qualityFilter = quality && VALID_QUALITIES.has(quality) ? quality as CardQuality : undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
    const now = new Date();

    // Determine "lens" langs for filtering blocos shown to user
    const lensLangs: string[] | null = lang
        ? [lang]
        : tier
            ? getTierLangs(`Tier ${tier.toUpperCase()}`)
            : null;

    // Build where clause for reviews — no exclusion, just priority
    const reviewWhere: Record<string, unknown> = {
        due: { lte: now },
    };

    // If lang/tier, still limit due reviews to relevant ones (SRS is per-lang)
    if (lang) {
        reviewWhere.langCode = lang;
    } else if (tier) {
        const tierKey = `Tier ${tier.toUpperCase()}` as keyof typeof TIER_SRS_WEIGHT;
        const tierLangs = getTierLangs(tierKey);
        if (tierLangs.length > 0) {
            reviewWhere.langCode = { in: tierLangs };
        }
    }

    // Blocos include: only lens langs if set, otherwise all
    const blocosInclude = lensLangs
        ? { where: { langCode: { in: lensLangs } } }
        : true;

    const dueReviews = await prisma.review.findMany({
        where: {
            ...reviewWhere,
            ...(qualityFilter ? { card: { quality: qualityFilter } } : {}),
        },
        include: {
            card: {
                include: {
                    blocos: blocosInclude as any,
                    difficulties: true,
                    tags: { include: { tag: true } },
                },
            },
        },
        orderBy: { due: "asc" },
        take: limit,
    });

    // Also find cards with NO reviews (new cards) — ALL cards, no exclusion
    const reviewedCardIds = dueReviews.map((r) => r.cardId);
    const newCards = await prisma.card.findMany({
        where: {
            id: { notIn: reviewedCardIds },
            ...(qualityFilter ? { quality: qualityFilter } : {}),
        },
        include: {
            blocos: blocosInclude as any,
            difficulties: true,
            tags: { include: { tag: true } },
        },
        take: Math.max(0, limit - dueReviews.length),
    });

    // Prioritize new cards: those with matching idiomasPrincipais first, then shuffle
    const prioritized = [...newCards].sort((a, b) => {
        if (lensLangs) {
            const aHas = a.idiomasPrincipais?.some((l: string) => lensLangs.includes(l)) ? 1 : 0;
            const bHas = b.idiomasPrincipais?.some((l: string) => lensLangs.includes(l)) ? 1 : 0;
            if (aHas !== bHas) return bHas - aHas;
        }
        return Math.random() - 0.5;
    });

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

        // Boost if card has this lang as principal
        const principalBoost = r.card.idiomasPrincipais?.includes(langCode) ? 1.5 : 1.0;

        const overdueDays = Math.max(0, (nowMs - r.due.getTime()) / 86_400_000);
        const priority = weight * principalBoost * (1 + overdueDays) + Math.random() * 0.4;
        return { ...r, priority };
    });

    weighted.sort((a, b) => b.priority - a.priority);

    return NextResponse.json({
        due: weighted,
        new: prioritized,
        total: weighted.length + prioritized.length,
        lensLangs,
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
