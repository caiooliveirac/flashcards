import { PrismaClient } from "@prisma/client";
import type { BatchOutput } from "./generator";
import { qaCheck } from "../lib/qa";
import { normalizeFrentePt } from "../lib/normalize";
import { LANG_CODES } from "../lib/types";
import type { ParsedLangBloco, ParsedCard } from "../lib/parser";

const prisma = new PrismaClient();

const BLOCO_FIELDS = [
    "natural", "romanizacao", "variacaoNativa", "literal", "padrao",
    "gramatica", "obs", "erroTipico", "contraste", "armadilha",
    "padraoReutilizavel", "gatilho", "registro",
    "sinonimos", "antonimo", "collocations", "campoSemantico", "registroVariacoes",
] as const;

function mergeBatches(batches: BatchOutput[]): Record<string, Record<string, string>> {
    const merged: Record<string, Record<string, string>> = {};

    for (const batch of batches) {
        for (const [langCode, fields] of Object.entries(batch.parsed)) {
            merged[langCode] = fields;
        }
    }

    return merged;
}

function buildParsedCard(
    chunkPt: string,
    contexto: string,
    merged: Record<string, Record<string, string>>,
    notaGlobal: string,
    teaches?: string
): ParsedCard {
    const idiomas: ParsedLangBloco[] = [];

    for (const lang of LANG_CODES) {
        const fields = merged[lang];
        if (!fields) {
            throw new Error(`Missing language block: ${lang}`);
        }

        idiomas.push({
            langCode: lang,
            natural: fields.natural ?? "",
            romanizacao: fields.romanizacao ?? "—",
            variacaoNativa: fields.variacaoNativa,
            literal: fields.literal ?? "",
            padrao: fields.padrao ?? "",
            gramatica: fields.gramatica,
            obs: fields.obs ?? "",
            erroTipico: fields.erroTipico ?? "",
            contraste: fields.contraste ?? "",
            armadilha: fields.armadilha ?? "",
            padraoReutilizavel: fields.padraoReutilizavel ?? "",
            sinonimos: fields.sinonimos,
            antonimo: fields.antonimo,
            collocations: fields.collocations,
            campoSemantico: fields.campoSemantico,
            registroVariacoes: fields.registroVariacoes,
            gatilho: fields.gatilho ?? "",
            registro: fields.registro ?? "neutro-polido",
        });
    }

    return {
        tipo: "chunk",
        contexto,
        frentePt: chunkPt,
        notaGlobal,
        objetivo: teaches ?? "",
        nivel: "a1",
        categoria: "pedido",
        idiomas,
    };
}

export interface AssembleResult {
    success: boolean;
    cardId?: string;
    qaScore: number;
    flags: string[];
    quality: "raw" | "suspicious" | "rejected";
    error?: string;
}

export async function assembleCard(
    chunkPt: string,
    contexto: string,
    batches: BatchOutput[],
    jobId?: string,
    teaches?: string
): Promise<AssembleResult> {
    // 1. Merge batches
    const merged = mergeBatches(batches);

    // Store combined raw TSV for debugging
    const rawTsv = batches.map(b => `--- ${b.batchName} ---\n${b.raw}`).join("\n\n").substring(0, 10000);
    if (jobId) {
        await prisma.generationJob.update({
            where: { id: jobId },
            data: { rawTsv },
        });
    }

    // 2. Check if all 25 langs are present
    const missingLangs = LANG_CODES.filter((l) => !merged[l]);
    if (missingLangs.length > 0) {
        return {
            success: false,
            qaScore: 0,
            flags: [`missing_langs: ${missingLangs.join(",")}`],
            quality: "rejected",
            error: `Missing ${missingLangs.length} languages: ${missingLangs.join(", ")}`,
        };
    }

    // 3. Extract notaGlobal from first batch that has it
    const notaGlobal = batches.find((b) => b.notaGlobal)?.notaGlobal ?? "";

    // 4. Build ParsedCard and run QA
    const parsedCard = buildParsedCard(chunkPt, contexto, merged, notaGlobal, teaches);
    const qa = qaCheck(parsedCard);

    let quality: "raw" | "suspicious" | "rejected";
    if (qa.score > 0.7) {
        quality = "raw";
    } else if (qa.score >= 0.4) {
        quality = "suspicious";
    } else {
        quality = "rejected";
    }

    // 4. Update job status if provided
    if (jobId) {
        await prisma.generationJob.update({
            where: { id: jobId },
            data: {
                qaScore: qa.score,
                qaFlags: qa.flags,
                qaChecks: JSON.parse(JSON.stringify({ checks: qa.checks })),
                status: quality === "rejected" ? "failed" : "done",
            },
        });
    }

    if (quality === "rejected") {
        return {
            success: false,
            qaScore: qa.score,
            flags: qa.flags,
            quality: "rejected",
            error: `QA score too low: ${qa.score.toFixed(2)}`,
        };
    }

    // 5. Persist card
    const frentePtNorm = normalizeFrentePt(chunkPt);

    const card = await prisma.card.create({
        data: {
            tipo: "chunk",
            contexto,
            frentePt: chunkPt,
            frentePtNorm,
            notaGlobal: parsedCard.notaGlobal || "",
            objetivo: parsedCard.objetivo || "",
            nivel: "a1",
            categoria: "pedido",
            source: "haiku_auto",
            quality,
            blocos: {
                create: parsedCard.idiomas.map((b) => ({
                    langCode: b.langCode,
                    natural: b.natural,
                    romanizacao: b.romanizacao,
                    variacaoNativa: b.variacaoNativa || null,
                    literal: b.literal,
                    padrao: b.padrao,
                    gramatica: b.gramatica || null,
                    obs: b.obs,
                    erroTipico: b.erroTipico,
                    contraste: b.contraste,
                    armadilha: b.armadilha,
                    padraoReutilizavel: b.padraoReutilizavel,
                    gatilho: b.gatilho,
                    registro: b.registro,
                    sinonimos: b.sinonimos || null,
                    antonimo: b.antonimo || null,
                    collocations: b.collocations || null,
                    campoSemantico: b.campoSemantico || null,
                    registroVariacoes: b.registroVariacoes || null,
                })),
            },
        },
    });

    // 6. Update job with card reference
    if (jobId) {
        await prisma.generationJob.update({
            where: { id: jobId },
            data: { completedAt: new Date() },
        });
    }

    return {
        success: true,
        cardId: card.id,
        qaScore: qa.score,
        flags: qa.flags,
        quality,
    };
}
