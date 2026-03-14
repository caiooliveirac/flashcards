import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const card = await prisma.card.findUnique({
        where: { id: params.id },
        include: {
            blocos: true,
            reviews: { orderBy: { reviewedAt: "desc" }, take: 20 },
            difficulties: true,
            tags: { include: { tag: true } },
        },
    });

    if (!card) {
        return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json(card);
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    await prisma.card.delete({ where: { id: params.id } });
    return NextResponse.json({ deleted: true });
}
