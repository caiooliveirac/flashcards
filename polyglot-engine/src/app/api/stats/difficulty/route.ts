import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
    const difficulties = await prisma.langDifficulty.groupBy({
        by: ["langCode", "level"],
        _count: true,
    });

    return NextResponse.json({ difficulties });
}
