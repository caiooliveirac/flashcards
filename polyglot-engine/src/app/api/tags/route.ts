import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createTagSchema = z.object({
    name: z.string().min(1).transform((s) => s.toLowerCase().trim()),
});

export async function GET() {
    const tags = await prisma.tag.findMany({
        include: { _count: { select: { cards: true } } },
        orderBy: { name: "asc" },
    });
    return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = createTagSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tag = await prisma.tag.upsert({
        where: { name: parsed.data.name },
        update: {},
        create: { name: parsed.data.name },
    });

    return NextResponse.json(tag, { status: 201 });
}
