import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeFrentePt } from "@/lib/normalize";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCardSchema = z.object({
    tipo: z.enum(["chunk", "padrao", "discriminacao", "cloze"]),
    contexto: z.string().min(1),
    frentePt: z.string().min(1),
    notaGlobal: z.string().min(1),
    objetivo: z.string().min(1),
    idiomasPrincipais: z.array(z.string()).min(1),
    familiaContraste: z.string().optional(),
    nivel: z.enum(["a1", "a2", "b1", "b2", "c1"]),
    categoria: z.enum([
        "apresentacao", "polidez", "reparo_conversacional", "pedido",
        "direcao", "transporte", "emergencia", "trabalho", "socializacao",
        "comida", "hospedagem", "compras", "saude", "tempo", "numeros",
        "sentimentos", "opiniao", "comparacao", "descricao", "rotina",
    ]),
    source: z.enum(["haiku_auto", "haiku_manual", "opus_gold", "manual", "import_tsv"]).optional(),
    tags: z.array(z.string()).optional(),
    blocos: z.array(z.object({
        langCode: z.string().length(2).or(z.literal("BCS")),
        natural: z.string().min(1),
        romanizacao: z.string().default("—"),
        variacaoNativa: z.string().optional(),
        literal: z.string().min(1),
        padrao: z.string().min(1),
        gramatica: z.string().optional(),
        obs: z.string().min(1),
        erroTipico: z.string().min(1),
        contraste: z.string().min(1),
        armadilha: z.string().min(1),
        padraoReutilizavel: z.string().min(1),
        sinonimos: z.string().optional(),
        antonimo: z.string().optional(),
        collocations: z.string().optional(),
        campoSemantico: z.string().optional(),
        registroVariacoes: z.string().optional(),
        gatilho: z.string().min(1),
        registro: z.string().min(1),
    })).optional(),
});

export async function GET(request: NextRequest) {
    const url = request.nextUrl;
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20"), 100);
    const quality = url.searchParams.get("quality");
    const categoria = url.searchParams.get("categoria");
    const nivel = url.searchParams.get("nivel");
    const search = url.searchParams.get("q");
    const sort = url.searchParams.get("sort") ?? "newest";
    const tier = url.searchParams.get("tier");
    const lang = url.searchParams.get("lang");

    const tierMap: Record<string, string[]> = {
        S: ["DE", "EN", "FR", "IT", "ES"],
        A: ["JA", "KO", "ZH", "RU", "AR"],
        B: ["SV", "NO", "NL", "DA", "FI"],
        C: ["BCS", "HU", "CS", "PL", "TR"],
        D: ["TH", "VI", "HE", "EL", "ID"],
    };

    // Determine which langs to show as "lens" (preview blocos)
    const lensLangs: string[] | null = lang
        ? [lang]
        : tier && tierMap[tier.toUpperCase()]
            ? tierMap[tier.toUpperCase()]
            : null;

    const where: Record<string, unknown> = {};
    if (quality) where.quality = quality;
    if (categoria) where.categoria = categoria;
    if (nivel) where.nivel = nivel;
    if (search) where.frentePt = { contains: search, mode: "insensitive" };

    // No exclusion for tier/lang — all cards always returned.
    // Priority ordering: cards with matching idiomasPrincipais first.

    // Sort options
    let orderBy: Record<string, string>;
    switch (sort) {
        case "oldest": orderBy = { seq: "asc" }; break;
        case "qa_worst": orderBy = { quality: "asc" }; break;
        default: orderBy = { seq: "desc" }; break;
    }

    const [cards, total] = await Promise.all([
        prisma.card.findMany({
            where,
            include: {
                blocos: lensLangs
                    ? { where: { langCode: { in: lensLangs } } }
                    : { where: { langCode: { in: ["DE", "EN", "FR", "IT", "ES"] } } },
                tags: { include: { tag: true } },
                _count: { select: { reviews: true, blocos: true } },
            },
            orderBy,
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.card.count({ where }),
    ]);

    // Re-sort: prioritize cards whose idiomasPrincipais overlap with selected lens
    if (lensLangs && sort === "newest") {
        cards.sort((a, b) => {
            const aHas = a.idiomasPrincipais?.some((l: string) => lensLangs.includes(l)) ? 1 : 0;
            const bHas = b.idiomasPrincipais?.some((l: string) => lensLangs.includes(l)) ? 1 : 0;
            return bHas - aHas; // principal first
        });
    }

    return NextResponse.json({ cards, total, page, limit, lensLangs });
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = createCardSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tags, blocos, ...cardData } = parsed.data;
    const frentePtNorm = normalizeFrentePt(cardData.frentePt);

    const existing = await prisma.card.findUnique({ where: { frentePtNorm } });
    if (existing) {
        return NextResponse.json(
            { error: "Card with this frentePt already exists", existingId: existing.id },
            { status: 409 }
        );
    }

    const card = await prisma.card.create({
        data: {
            ...cardData,
            frentePtNorm,
            blocos: blocos ? { create: blocos } : undefined,
            tags: tags
                ? {
                    create: await Promise.all(
                        tags.map(async (name) => {
                            const tag = await prisma.tag.upsert({
                                where: { name: name.toLowerCase() },
                                update: {},
                                create: { name: name.toLowerCase() },
                            });
                            return { tagId: tag.id };
                        })
                    ),
                }
                : undefined,
        },
        include: { blocos: true, tags: { include: { tag: true } } },
    });

    return NextResponse.json(card, { status: 201 });
}
