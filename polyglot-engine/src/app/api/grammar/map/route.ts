import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/grammar/map?lang=DE
 * Returns all grammar modules for a language, organized by cluster.
 * Used by the Grammar Map page to render the node graph.
 */
export async function GET(request: NextRequest) {
    const lang = request.nextUrl.searchParams.get("lang");

    if (!lang) {
        return NextResponse.json({ error: "Missing lang parameter" }, { status: 400 });
    }

    const modules = await prisma.grammarModule.findMany({
        where: { language: lang.toUpperCase() },
        select: {
            id: true,
            language: true,
            cluster: true,
            title: true,
            subtitle: true,
            level: true,
            prerequisites: true,
            status: true,
            qualityScore: true,
            createdAt: true,
        },
        orderBy: [{ cluster: "asc" }, { level: "asc" }, { title: "asc" }],
    });

    // Group by cluster
    const clusters: Record<string, typeof modules> = {};
    for (const m of modules) {
        if (!clusters[m.cluster]) clusters[m.cluster] = [];
        clusters[m.cluster].push(m);
    }

    return NextResponse.json({
        language: lang.toUpperCase(),
        total: modules.length,
        clusters,
        modules,
    });
}
