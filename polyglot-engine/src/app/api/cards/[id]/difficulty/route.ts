import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const difficultySchema = z.object({
    langCode: z.string().min(2),
    level: z.enum(["easy", "medium", "hard", "blocked"]),
    types: z.array(z.enum([
        "pronuncia", "escrita", "gramatica", "vocabulario",
        "interferencia", "tom", "caso", "ordem",
    ])),
    note: z.string().optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await request.json();
    const parsed = difficultySchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const difficulty = await prisma.langDifficulty.upsert({
        where: {
            cardId_langCode: { cardId: params.id, langCode: parsed.data.langCode },
        },
        update: {
            level: parsed.data.level,
            types: parsed.data.types,
            note: parsed.data.note,
        },
        create: {
            cardId: params.id,
            ...parsed.data,
        },
    });

    return NextResponse.json(difficulty);
}
