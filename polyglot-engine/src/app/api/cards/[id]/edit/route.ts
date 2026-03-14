import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

const editCardSchema = z.object({
    contexto: z.string().min(1).optional(),
    notaGlobal: z.string().min(1).optional(),
    objetivo: z.string().min(1).optional(),
    quality: z.enum(["raw", "reviewed", "edited", "gold", "deprecated", "suspicious"]).optional(),
    reviewedBy: z.string().optional(),
    blocos: z.array(z.object({
        langCode: z.string().min(2),
        natural: z.string().optional(),
        romanizacao: z.string().optional(),
        variacaoNativa: z.string().optional(),
        literal: z.string().optional(),
        padrao: z.string().optional(),
        gramatica: z.string().optional(),
        obs: z.string().optional(),
        erroTipico: z.string().optional(),
        contraste: z.string().optional(),
        armadilha: z.string().optional(),
        padraoReutilizavel: z.string().optional(),
        sinonimos: z.string().optional(),
        antonimo: z.string().optional(),
        collocations: z.string().optional(),
        campoSemantico: z.string().optional(),
        registroVariacoes: z.string().optional(),
        gatilho: z.string().optional(),
        registro: z.string().optional(),
    })).optional(),
});

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await request.json();
    const parsed = editCardSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { blocos, ...cardUpdates } = parsed.data;

    // If editing content, auto-set quality to edited
    if (blocos && !cardUpdates.quality) {
        cardUpdates.quality = "edited";
    }
    if (cardUpdates.reviewedBy) {
        (cardUpdates as Record<string, unknown>).reviewedAt = new Date();
    }

    const card = await prisma.card.update({
        where: { id: params.id },
        data: cardUpdates,
    });

    if (blocos) {
        for (const bloco of blocos) {
            const { langCode, ...updates } = bloco;
            await prisma.langBloco.updateMany({
                where: { cardId: params.id, langCode },
                data: updates,
            });
        }
    }

    const updated = await prisma.card.findUnique({
        where: { id: card.id },
        include: { blocos: true, tags: { include: { tag: true } } },
    });

    return NextResponse.json(updated);
}
