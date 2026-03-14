import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    let dbStatus = "disconnected";

    try {
        const { prisma } = await import("@/lib/db");
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = "connected";
    } catch {
        dbStatus = "disconnected";
    }

    return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        db: dbStatus,
    });
}
