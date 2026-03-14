import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isTooSimilar } from "@/lib/queue";
import type { Categoria, Nivel } from "@prisma/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

function toChunkRegistryData<T extends {
    chunkPt: string;
    categoria: string;
    nivel: string;
    prioridade: number;
    grammar_focus?: string[];
    teaches?: string;
    variacao?: string;
    parentChunk?: string;
}>(chunk: T) {
    return {
        chunkPt: chunk.chunkPt,
        categoria: chunk.categoria as Categoria,
        nivel: chunk.nivel as Nivel,
        prioridade: chunk.prioridade,
        grammarFocus: chunk.grammar_focus,
        teaches: chunk.teaches,
        variacao: chunk.variacao,
        parentChunk: chunk.parentChunk,
    };
}

const addChunksSchema = z.object({
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

// Legacy single-chunk format
const addSingleSchema = z.object({
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
    variacao: z.string().optional(),
    parentChunk: z.string().optional(),
});

export async function GET() {
    const [pending, generated] = await Promise.all([
        prisma.chunkRegistry.findMany({
            where: { gerado: false },
            orderBy: [{ prioridade: "desc" }, { createdAt: "asc" }],
        }),
        prisma.chunkRegistry.findMany({
            where: { gerado: true },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
    ]);

    // Estimate variation queue
    const generatedCount = await prisma.chunkRegistry.count({ where: { gerado: true } });
    const variationsAvailable = generatedCount * 7; // 7 strategies

    return NextResponse.json({
        static_queue: {
            total: pending.length + generated.length,
            pending,
            generated,
        },
        variation_queue: {
            available: variationsAvailable,
            next_10: [], // variations are generated dynamically
        },
    });
}

export async function POST(request: NextRequest) {
    const body = await request.json();

    // Support both formats: { chunks: [...] } and { chunkPt: "..." }
    if (body.chunks) {
        const parsed = addChunksSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
        }

        let added = 0;
        let duplicates = 0;
        let similarSkipped = 0;
        const entries: unknown[] = [];
        const similarMatches: Array<{ chunk: string; match: string; score: number }> = [];

        for (const chunk of parsed.data.chunks) {
            const existing = await prisma.chunkRegistry.findUnique({
                where: { chunkPt: chunk.chunkPt },
            });
            if (existing) {
                duplicates++;
                continue;
            }
            const sim = await isTooSimilar(chunk.chunkPt);
            if (sim.similar) {
                similarSkipped++;
                similarMatches.push({ chunk: chunk.chunkPt, match: sim.match!, score: sim.score! });
                continue;
            }
            const entry = await prisma.chunkRegistry.create({
                data: toChunkRegistryData(chunk),
            });
            entries.push(entry);
            added++;
        }

        return NextResponse.json({ added, duplicates, similarSkipped, similarMatches, entries }, { status: 201 });
    }

    // Legacy single-chunk format
    const parsed = addSingleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.chunkRegistry.findUnique({
        where: { chunkPt: parsed.data.chunkPt },
    });

    if (existing) {
        return NextResponse.json(
            { error: "Chunk already in queue", existing },
            { status: 409 }
        );
    }

    const sim = await isTooSimilar(parsed.data.chunkPt);
    if (sim.similar) {
        return NextResponse.json(
            { error: "Chunk too similar to existing", match: sim.match, score: sim.score },
            { status: 409 }
        );
    }

    const chunk = await prisma.chunkRegistry.create({
        data: toChunkRegistryData(parsed.data),
    });
    return NextResponse.json(chunk, { status: 201 });
}
