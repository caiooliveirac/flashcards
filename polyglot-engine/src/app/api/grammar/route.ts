import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/grammar?lang=DE&cluster=structure
 * Lists grammar modules, with optional filters.
 */
export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const lang = url.searchParams.get("lang");
    const cluster = url.searchParams.get("cluster");

    const where: Record<string, unknown> = {};
    if (lang) where.language = lang.toUpperCase();
    if (cluster) where.cluster = cluster;

    const modules = await prisma.grammarModule.findMany({
        where,
        select: {
            id: true,
            language: true,
            cluster: true,
            title: true,
            subtitle: true,
            level: true,
            status: true,
            prerequisites: true,
            qualityScore: true,
            createdAt: true,
        },
        orderBy: [{ language: "asc" }, { cluster: "asc" }, { title: "asc" }],
    });

    return NextResponse.json({ total: modules.length, modules });
}
