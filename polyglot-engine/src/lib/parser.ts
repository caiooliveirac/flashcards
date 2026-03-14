import { z } from "zod";
import { LANG_CODES } from "./types";

/**
 * TSV Parser for PolyGlot Bloco25 format.
 *
 * TSV format: 7 tab-separated fields per line
 * Field 7 (Bloco25): 25 language blocks separated by ||
 * Each block: key=value pairs separated by |
 */

// ─── Zod schemas ───

const langBlocoSchema = z.object({
    langCode: z.string(),
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
});

const parsedCardSchema = z.object({
    tipo: z.enum(["chunk", "padrao", "discriminacao", "cloze"]),
    contexto: z.string().min(1),
    frentePt: z.string().min(1),
    notaGlobal: z.string(),
    objetivo: z.string().min(1),
    nivel: z.enum(["a1", "a2", "b1", "b2", "c1"]),
    categoria: z.string().min(1),
    idiomas: z.array(langBlocoSchema).length(25),
});

export type ParsedLangBloco = z.infer<typeof langBlocoSchema>;
export type ParsedCard = z.infer<typeof parsedCardSchema>;

// ─── Parser ───

const BLOCO_KEYS = [
    "langCode", "natural", "romanizacao", "variacaoNativa", "literal",
    "padrao", "gramatica", "obs", "erroTipico", "contraste",
    "armadilha", "padraoReutilizavel", "sinonimos", "antonimo",
    "collocations", "campoSemantico", "registroVariacoes",
    "gatilho", "registro",
] as const;

function parseBlocoFields(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    const pairs = raw.split("|").map((p) => p.trim());

    for (const pair of pairs) {
        const eqIndex = pair.indexOf("=");
        if (eqIndex === -1) continue;
        const key = pair.substring(0, eqIndex).trim();
        const value = pair.substring(eqIndex + 1).trim();
        result[key] = value;
    }

    return result;
}

export function parseTSV(raw: string): ParsedCard[] {
    const lines = raw
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#"));

    const cards: ParsedCard[] = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const fields = line.split("\t");

        if (fields.length < 7) {
            throw new Error(
                `Line ${lineIdx + 1}: expected 7 tab-separated fields, got ${fields.length}`
            );
        }

        const [tipo, contexto, frentePt, notaGlobal, objetivo, nivelCategoria, bloco25Raw] = fields;

        // Parse nivel_categoria
        const ncParts = nivelCategoria.split("_");
        if (ncParts.length < 2) {
            throw new Error(
                `Line ${lineIdx + 1}: expected nivel_categoria format, got "${nivelCategoria}"`
            );
        }
        const nivel = ncParts[0];
        const categoria = ncParts.slice(1).join("_");

        // Parse Bloco25
        const blocos = bloco25Raw.split("||").map((b) => b.trim());
        if (blocos.length !== 25) {
            throw new Error(
                `Line ${lineIdx + 1}: expected 25 language blocks (||), got ${blocos.length}`
            );
        }

        const idiomas: ParsedLangBloco[] = [];
        for (let i = 0; i < blocos.length; i++) {
            const parsed = parseBlocoFields(blocos[i]);

            if (!parsed.langCode) {
                // If no langCode, use position order
                parsed.langCode = LANG_CODES[i];
            }

            idiomas.push(langBlocoSchema.parse(parsed));
        }

        const card = parsedCardSchema.parse({
            tipo,
            contexto,
            frentePt,
            notaGlobal,
            objetivo,
            nivel,
            categoria,
            idiomas,
        });

        cards.push(card);
    }

    return cards;
}
