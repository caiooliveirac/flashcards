import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Categoria, Nivel } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

function toChunkRegistryData(chunk: {
    chunkPt: string;
    categoria: string;
    nivel: string;
    prioridade: number;
    grammar_focus?: string[];
    teaches?: string;
}) {
    return {
        chunkPt: chunk.chunkPt,
        categoria: chunk.categoria as Categoria,
        nivel: chunk.nivel as Nivel,
        prioridade: chunk.prioridade,
        grammarFocus: chunk.grammar_focus,
        teaches: chunk.teaches,
    };
}

const bulkSchema = z.object({
    mode: z.enum(["merge", "replace"]),
    chunks: z.array(z.object({
        chunkPt: z.string().min(1),
        categoria: z.enum([
            "apresentacao", "polidez", "reparo_conversacional", "pedido",
            "direcao", "transporte", "emergencia", "trabalho", "socializacao",
            "comida", "hospedagem", "compras", "saude", "tempo", "numeros",
            "sentimentos", "opiniao", "comparacao", "descricao", "rotina",
        ]).default("pedido"),
        nivel: z.enum(["a1", "a2", "b1", "b2", "c1"]).default("a1"),
        grammar_focus: z.array(z.string()).optional(),
        teaches: z.string().optional(),
        prioridade: z.number().int().default(0),
    })).min(1),
});

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { mode, chunks } = parsed.data;

    if (mode === "replace") {
        // Delete all non-generated chunks
        await prisma.chunkRegistry.deleteMany({ where: { gerado: false } });
    }

    let added = 0;
    let duplicates = 0;

    for (const chunk of chunks) {
        const existing = await prisma.chunkRegistry.findUnique({
            where: { chunkPt: chunk.chunkPt },
        });
        if (existing) {
            duplicates++;
            continue;
        }
        await prisma.chunkRegistry.create({
            data: toChunkRegistryData(chunk),
        });
        added++;
    }

    return NextResponse.json({ mode, added, duplicates, total: chunks.length }, { status: 201 });
}
