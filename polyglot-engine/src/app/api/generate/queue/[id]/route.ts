import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
    prioridade: z.number().int().optional(),
    categoria: z.enum([
        "apresentacao", "polidez", "reparo_conversacional", "pedido",
        "direcao", "transporte", "emergencia", "trabalho", "socializacao",
        "comida", "hospedagem", "compras", "saude", "tempo", "numeros",
        "sentimentos", "opiniao", "comparacao", "descricao", "rotina",
    ]).optional(),
    nivel: z.enum(["a1", "a2", "b1", "b2", "c1"]).optional(),
});

export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await prisma.chunkRegistry.delete({ where: { id: params.id } });
        return NextResponse.json({ deleted: true });
    } catch {
        return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const updated = await prisma.chunkRegistry.update({
            where: { id: params.id },
            data: parsed.data,
        });
        return NextResponse.json(updated);
    } catch {
        return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }
}
