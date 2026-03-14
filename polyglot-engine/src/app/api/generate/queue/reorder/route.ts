import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const reorderSchema = z.object({
    ids: z.array(z.string()).min(1),
});

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { ids } = parsed.data;

    // Assign priorities: first gets highest, last gets lowest
    const updates = ids.map((id, index) =>
        prisma.chunkRegistry.update({
            where: { id },
            data: { prioridade: ids.length - index },
        })
    );

    await prisma.$transaction(updates);

    return NextResponse.json({ reordered: ids.length });
}
