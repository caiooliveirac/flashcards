import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeFrentePt } from "@/lib/normalize";
import { qaCheck } from "@/lib/qa";
import { LANG_CODES } from "@/lib/types";

export const dynamic = "force-dynamic";

const BLOCO_FIELDS = [
    "natural", "romanizacao", "variacaoNativa", "literal", "padrao",
    "gramatica", "obs", "erroTipico", "contraste", "armadilha",
    "padraoReutilizavel", "gatilho", "registro",
    "sinonimos", "antonimo", "collocations", "campoSemantico", "registroVariacoes",
] as const;

function parseTsvOutput(raw: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    const blocks = raw.split("||").map((b) => b.trim()).filter(Boolean);

    for (const block of blocks) {
        const fields: Record<string, string> = {};
        const pairs = block.split("|").map((p) => p.trim());

        for (const pair of pairs) {
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) continue;
            const key = pair.substring(0, eqIdx).trim();
            const value = pair.substring(eqIdx + 1).trim();
            fields[key] = value;
        }

        if (fields.langCode) {
            result[fields.langCode] = fields;
        }
    }

    return result;
}

/**
 * POST /api/cards/import-tsv
 * Body: { chunkPt, contexto?, nivel?, categoria?, tsv }
 * 
 * Parses the raw pipe-separated TSV output from Claude Opus,
 * runs QA, and persists a new card.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { chunkPt, tsv, contexto, nivel, categoria } = body;

        if (!chunkPt || typeof chunkPt !== "string" || chunkPt.trim().length === 0) {
            return NextResponse.json({ error: "chunkPt é obrigatório" }, { status: 400 });
        }
        if (!tsv || typeof tsv !== "string" || tsv.trim().length === 0) {
            return NextResponse.json({ error: "tsv (output do Opus) é obrigatório" }, { status: 400 });
        }

        // Check for duplicate
        const norm = normalizeFrentePt(chunkPt.trim());
        const existing = await prisma.card.findFirst({ where: { frentePtNorm: norm } });
        if (existing) {
            return NextResponse.json({
                error: `Card já existe: #${existing.seq} "${existing.frentePt}"`,
                existing: { id: existing.id, seq: existing.seq },
            }, { status: 409 });
        }

        // Parse TSV
        const parsed = parseTsvOutput(tsv);
        const foundLangs = Object.keys(parsed);

        if (foundLangs.length === 0) {
            return NextResponse.json({
                error: "Nenhum bloco de idioma encontrado no TSV. Verifique o formato (langCode=XX | campo=valor || ...)",
            }, { status: 400 });
        }

        // Check which of the 25 langs are present
        const presentLangs = LANG_CODES.filter((l) => parsed[l]);
        const missingLangs = LANG_CODES.filter((l) => !parsed[l]);

        // Build blocos for present languages
        const blocos = presentLangs.map((langCode) => {
            const fields = parsed[langCode];
            return {
                langCode,
                natural: fields.natural ?? "",
                romanizacao: fields.romanizacao ?? "—",
                variacaoNativa: fields.variacaoNativa || null,
                literal: fields.literal ?? "",
                padrao: fields.padrao ?? "",
                gramatica: fields.gramatica || null,
                obs: fields.obs ?? "",
                erroTipico: fields.erroTipico ?? "",
                contraste: fields.contraste ?? "",
                armadilha: fields.armadilha ?? "",
                padraoReutilizavel: fields.padraoReutilizavel ?? "",
                gatilho: fields.gatilho ?? "",
                registro: fields.registro ?? "neutro-polido",
                sinonimos: fields.sinonimos || null,
                antonimo: fields.antonimo || null,
                collocations: fields.collocations || null,
                campoSemantico: fields.campoSemantico || null,
                registroVariacoes: fields.registroVariacoes || null,
            };
        });

        // Derive idiomasPrincipais from what was provided
        const idiomasPrincipais = presentLangs;

        // Run QA check (build a ParsedCard-like structure)
        const parsedCard = {
            tipo: "chunk" as const,
            contexto: contexto?.trim() || "importação manual via Opus",
            frentePt: chunkPt.trim(),
            notaGlobal: "",
            objetivo: "",
            nivel: (nivel || "a1") as "a1",
            categoria: (categoria || "pedido") as "pedido",
            idiomas: blocos.map((b) => ({
                langCode: b.langCode,
                natural: b.natural,
                romanizacao: b.romanizacao ?? "—",
                variacaoNativa: b.variacaoNativa ?? undefined,
                literal: b.literal,
                padrao: b.padrao,
                gramatica: b.gramatica ?? undefined,
                obs: b.obs,
                erroTipico: b.erroTipico,
                contraste: b.contraste,
                armadilha: b.armadilha,
                padraoReutilizavel: b.padraoReutilizavel,
                gatilho: b.gatilho,
                registro: b.registro,
                sinonimos: b.sinonimos ?? undefined,
                antonimo: b.antonimo ?? undefined,
                collocations: b.collocations ?? undefined,
                campoSemantico: b.campoSemantico ?? undefined,
                registroVariacoes: b.registroVariacoes ?? undefined,
            })),
        };

        const qa = qaCheck(parsedCard);
        const quality = missingLangs.length > 5 ? "raw" : (qa.score > 0.7 ? "raw" : "suspicious");

        // Persist card
        const card = await prisma.card.create({
            data: {
                tipo: "chunk",
                contexto: contexto?.trim() || "importação manual via Opus",
                frentePt: chunkPt.trim(),
                frentePtNorm: norm,
                notaGlobal: "",
                objetivo: "",
                nivel: nivel || "a1",
                categoria: categoria || "pedido",
                source: "opus_gold",
                quality,
                idiomasPrincipais: idiomasPrincipais,
                blocos: { create: blocos },
            },
        });

        return NextResponse.json({
            success: true,
            card: {
                id: card.id,
                seq: card.seq,
                frentePt: card.frentePt,
                quality,
                qaScore: qa.score,
                qaFlags: qa.flags,
                langsImported: presentLangs.length,
                langsMissing: missingLangs.length,
                missingLangs: missingLangs.length > 0 ? missingLangs : undefined,
            },
        });
    } catch (err) {
        console.error("[IMPORT-TSV] Error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        );
    }
}
