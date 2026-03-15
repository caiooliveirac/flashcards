import { PrismaClient } from "@prisma/client";
import { normalizeFrentePt } from "./normalize";
import { readFileSync } from "fs";
import { join } from "path";

const prisma = new PrismaClient();

// ─── Chunk metadata from static queue ───

export interface ChunkMeta {
    id: string;
    level: string;
    category: string;
    pt: string;
    grammar_focus: string[];
    teaches: string;
}

interface ChunkResult {
    chunkPt: string;
    contexto: string;
    source: string;
    nivel?: string;
    categoria?: string;
    grammarFocus?: string[];
    teaches?: string;
}

const CATEGORY_TO_CONTEXTO: Record<string, string> = {
    greetings: "apresentação social",
    survival: "situação de emergência",
    numbers_time_money: "comércio e horários",
    food_drink: "restaurante",
    navigation: "rua / transporte",
    social: "conversa social",
    social_basics: "conversa social básica",
    travel: "viagem / hotel",
    shopping: "comércio / loja",
    health: "saúde / farmácia",
    daily_routine: "rotina diária",
    daily_actions: "ações do dia a dia",
    identity: "identidade pessoal",
    accommodation: "hospedagem / hotel",
    weather_nature: "clima e natureza",
    transport: "transporte público",
    politeness: "polidez e cortesia",
    technology: "tecnologia / digital",
    family_people: "família e pessoas",
    descriptions: "descrição de lugares e coisas",
    problems: "problemas e reclamações",
    comparisons: "comparações",
    quantities: "quantidades e medidas",
    basic_opinions: "opiniões básicas",
    plans_wishes: "planos e desejos",
    feelings_states: "sentimentos e estados",
    home_objects: "casa e objetos",
    emotions_reactions: "emoções e reações",
    narrating_past: "narrando o passado",
    advice_suggestions: "conselhos e sugestões",
    culture_customs: "cultura e costumes",
    work_study: "trabalho e estudo",
    relationships: "relacionamentos",
    hypotheticals: "hipóteses e condicionais",
    negotiation_conflict: "negociação e conflito",
    environment_city: "cidade e meio ambiente",
    communication: "comunicação e mensagens",
    leisure_entertainment: "lazer e entretenimento",
    future_plans: "planos futuros",
};

const CATEGORY_TO_PRISMA: Record<string, string> = {
    greetings: "apresentacao",
    survival: "emergencia",
    numbers_time_money: "numeros",
    food_drink: "comida",
    navigation: "direcao",
    social: "socializacao",
    social_basics: "socializacao",
    travel: "hospedagem",
    shopping: "compras",
    health: "saude",
    daily_routine: "rotina",
    daily_actions: "rotina",
    identity: "apresentacao",
    accommodation: "hospedagem",
    weather_nature: "tempo",
    transport: "transporte",
    politeness: "polidez",
    technology: "pedido",
    family_people: "socializacao",
    descriptions: "descricao",
    problems: "reparo_conversacional",
    comparisons: "comparacao",
    quantities: "numeros",
    basic_opinions: "opiniao",
    plans_wishes: "pedido",
    feelings_states: "sentimentos",
    home_objects: "pedido",
    emotions_reactions: "sentimentos",
    narrating_past: "socializacao",
    advice_suggestions: "opiniao",
    culture_customs: "socializacao",
    work_study: "trabalho",
    relationships: "socializacao",
    hypotheticals: "opiniao",
    negotiation_conflict: "reparo_conversacional",
    environment_city: "descricao",
    communication: "pedido",
    leisure_entertainment: "socializacao",
    future_plans: "pedido",
};

const NIVEL_MAP: Record<string, string> = {
    A1: "a1", A2: "a2", B1: "b1", B2: "b2", C1: "c1",
};

function loadStaticQueue(): ChunkMeta[] {
    const paths = [
        join(process.cwd(), "data", "chunk-queue.json"),
        join(__dirname, "..", "data", "chunk-queue.json"),
        join(process.cwd(), "src", "data", "chunk-queue.json"),
    ];
    for (const p of paths) {
        try {
            const raw = readFileSync(p, "utf-8");
            return JSON.parse(raw) as ChunkMeta[];
        } catch {
            // try next
        }
    }
    return [];
}

export async function isDuplicate(chunkPt: string): Promise<boolean> {
    const norm = normalizeFrentePt(chunkPt);

    // Check ChunkRegistry
    const inRegistry = await prisma.chunkRegistry.findUnique({
        where: { chunkPt: norm },
    });
    if (inRegistry) return true;

    // Check Card.frentePtNorm
    const inCards = await prisma.card.findUnique({
        where: { frentePtNorm: norm },
    });
    return !!inCards;
}

// ─── Similarity check ───

function tokenize(text: string): string[] {
    return normalizeFrentePt(text)
        .split(/\s+/)
        .filter((w) => w.length > 2);
}

function jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const w of setA) if (setB.has(w)) intersection++;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.55;

/**
 * Check if a phrase is too similar to existing cards or pending chunks.
 * Returns the best match if score >= threshold.
 */
export async function isTooSimilar(
    chunkPt: string,
    threshold = SIMILARITY_THRESHOLD
): Promise<{ similar: boolean; match?: string; score?: number }> {
    const tokens = tokenize(chunkPt);
    if (tokens.length === 0) return { similar: false };

    // Load all card fronts + pending chunks in one query each
    const [cards, pending] = await Promise.all([
        prisma.card.findMany({ select: { frentePt: true } }),
        prisma.chunkRegistry.findMany({ select: { chunkPt: true } }),
    ]);

    let bestScore = 0;
    let bestMatch = "";

    for (const card of cards) {
        const score = jaccardSimilarity(tokens, tokenize(card.frentePt));
        if (score > bestScore) {
            bestScore = score;
            bestMatch = card.frentePt;
        }
    }

    for (const chunk of pending) {
        const score = jaccardSimilarity(tokens, tokenize(chunk.chunkPt));
        if (score > bestScore) {
            bestScore = score;
            bestMatch = chunk.chunkPt;
        }
    }

    if (bestScore >= threshold) {
        return { similar: true, match: bestMatch, score: bestScore };
    }
    return { similar: false };
}

export async function registerChunk(
    chunkPt: string,
    source: string = "queue"
): Promise<void> {
    const norm = normalizeFrentePt(chunkPt);
    await prisma.chunkRegistry.upsert({
        where: { chunkPt: norm },
        update: { gerado: true },
        create: { chunkPt: norm, rawPt: chunkPt, categoria: "pedido", nivel: "a1", gerado: true },
    });
}

export async function markChunkFailed(chunkPt: string): Promise<void> {
    const norm = normalizeFrentePt(chunkPt);
    // Mark gerado: true so getNextChunk never retries this chunk.
    // Failed status is tracked via GenerationJob (status: "failed").
    await prisma.chunkRegistry.upsert({
        where: { chunkPt: norm },
        update: { gerado: true },
        create: { chunkPt: norm, rawPt: chunkPt, categoria: "pedido", nivel: "a1", gerado: true },
    });
}

export async function getNextChunk(): Promise<ChunkResult | null> {
    // Source 1: DB priority queue (manual additions via API)
    const priorityChunk = await prisma.chunkRegistry.findFirst({
        where: { gerado: false },
        orderBy: [{ prioridade: "desc" }, { createdAt: "asc" }],
    });

    if (priorityChunk) {
        return {
            chunkPt: priorityChunk.rawPt ?? priorityChunk.chunkPt,
            contexto: inferContexto(priorityChunk.rawPt ?? priorityChunk.chunkPt),
            source: "db_queue",
            nivel: priorityChunk.nivel,
            categoria: priorityChunk.categoria,
            grammarFocus: priorityChunk.grammarFocus as string[] | undefined,
            teaches: priorityChunk.teaches ?? undefined,
        };
    }

    // Source 2: Static queue — find first non-duplicate / non-similar
    const staticQueue = loadStaticQueue();
    for (const chunk of staticQueue) {
        if (await isDuplicate(chunk.pt)) continue;
        const sim = await isTooSimilar(chunk.pt);
        if (sim.similar) {
            console.log(
                `[QUEUE] Skipping similar: "${chunk.pt}" ≈ "${sim.match}" (${(sim.score! * 100).toFixed(0)}%)`
            );
            // Register as skipped so we don't re-check next cycle
            await prisma.chunkRegistry.upsert({
                where: { chunkPt: normalizeFrentePt(chunk.pt) },
                update: {},
                create: {
                    chunkPt: normalizeFrentePt(chunk.pt),
                    rawPt: chunk.pt,
                    categoria: (CATEGORY_TO_PRISMA[chunk.category] ?? "pedido") as "pedido",
                    nivel: (NIVEL_MAP[chunk.level] ?? "a1") as "a1",
                    gerado: true,
                },
            });
            continue;
        }
        return {
            chunkPt: chunk.pt,
            contexto: CATEGORY_TO_CONTEXTO[chunk.category] ?? chunk.category,
            source: "queue",
            nivel: NIVEL_MAP[chunk.level] ?? "a1",
            categoria: CATEGORY_TO_PRISMA[chunk.category] ?? "pedido",
            grammarFocus: chunk.grammar_focus,
            teaches: chunk.teaches,
        };
    }

    // Source 3: Auto-refill — ask Haiku for new phrases
    const newChunk = await autoRefillQueue();
    if (newChunk) return newChunk;

    return null;
}

// ─── Auto-refill via Haiku ───

async function autoRefillQueue(): Promise<ChunkResult | null> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return null;

    // Gather existing phrases to avoid
    const existing = await prisma.card.findMany({
        select: { frentePt: true },
        orderBy: { createdAt: "desc" },
        take: 80,
    });
    const existingList = existing.map((c) => c.frentePt).join("\n");

    const levels = ["A1", "A1", "A1", "A2", "A2", "B1"];
    const level = levels[Math.floor(Math.random() * levels.length)];

    const categories = [
        "greetings", "survival", "numbers_time_money", "food_drink",
        "navigation", "social", "travel", "shopping", "health", "daily_routine",
        "feelings", "opinions", "work", "directions", "phone_calls",
    ];
    const category = categories[Math.floor(Math.random() * categories.length)];

    const prompt = `Generate 8 natural pt-BR phrases (level ${level}, topic: ${category}) for polyglot flashcards.
Rules:
- Each phrase 4-15 words, natural Brazilian Portuguese
- Vary structures: statements, questions, requests, exclamations
- Avoid overlap with these existing phrases:
${existingList}

Output ONLY a JSON array of objects: [{"pt":"...","teaches":"...","grammar_focus":["..."]}]
No markdown, no explanation.`;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 1024,
                temperature: 0.9,
                messages: [{ role: "user", content: prompt }],
            }),
        });

        if (!response.ok) {
            console.warn(`[QUEUE] Auto-refill API error: ${response.status}`);
            return null;
        }

        const data = (await response.json()) as {
            content: Array<{ type: string; text?: string }>;
        };
        const text = data.content.find((c) => c.type === "text")?.text ?? "";
        const phrases = JSON.parse(text) as Array<{
            pt: string;
            teaches?: string;
            grammar_focus?: string[];
        }>;

        let added = 0;
        for (const phrase of phrases) {
            if (!phrase.pt || phrase.pt.length < 5) continue;
            if (await isDuplicate(phrase.pt)) continue;
            const sim = await isTooSimilar(phrase.pt);
            if (sim.similar) {
                console.log(
                    `[QUEUE] Auto-refill skip similar: "${phrase.pt}" ≈ "${sim.match}" (${(sim.score! * 100).toFixed(0)}%)`
                );
                continue;
            }

            const norm = normalizeFrentePt(phrase.pt);
            await prisma.chunkRegistry.create({
                data: {
                    chunkPt: norm,
                    rawPt: phrase.pt,
                    categoria: (CATEGORY_TO_PRISMA[category] ?? "pedido") as "pedido",
                    nivel: (NIVEL_MAP[level] ?? "a1") as "a1",
                    grammarFocus: phrase.grammar_focus,
                    teaches: phrase.teaches,
                    prioridade: 0,
                    gerado: false,
                },
            });
            added++;
        }

        console.log(`[QUEUE] Auto-refill: ${added}/${phrases.length} new chunks added (level=${level}, cat=${category})`);

        if (added > 0) {
            // Return the first pending one
            const first = await prisma.chunkRegistry.findFirst({
                where: { gerado: false },
                orderBy: { createdAt: "asc" },
            });
            if (first) {
                return {
                    chunkPt: first.rawPt ?? first.chunkPt,
                    contexto: inferContexto(first.rawPt ?? first.chunkPt),
                    source: "auto_refill",
                    nivel: first.nivel,
                    categoria: first.categoria,
                    grammarFocus: first.grammarFocus as string[] | undefined,
                    teaches: first.teaches ?? undefined,
                };
            }
        }
    } catch (err) {
        console.warn("[QUEUE] Auto-refill error:", err instanceof Error ? err.message : err);
    }

    return null;
}

function inferContexto(chunk: string): string {
    const lower = chunk.toLowerCase();
    if (lower.includes("café") || lower.includes("conta") || lower.includes("prato"))
        return "restaurante";
    if (lower.includes("médico") || lower.includes("alérgic") || lower.includes("emergência"))
        return "hospital";
    if (lower.includes("hotel") || lower.includes("reserva"))
        return "hotel";
    if (lower.includes("trem") || lower.includes("ônibus") || lower.includes("estação"))
        return "transporte público";
    if (lower.includes("dinheiro") || lower.includes("cartão") || lower.includes("custa"))
        return "comércio";
    if (lower.includes("passaporte") || lower.includes("alfândega"))
        return "aeroporto";
    return "conversa do dia a dia";
}
