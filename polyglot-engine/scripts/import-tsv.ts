// Import cards from a TSV file into the database
// Usage: npx tsx scripts/import-tsv.ts <file.tsv>

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { parseTSV } from "../src/lib/parser";
import { normalizeFrentePt } from "../src/lib/normalize";
import { qaCheck } from "../src/lib/qa";

const prisma = new PrismaClient();

async function main() {
    const file = process.argv[2];
    if (!file) {
        console.error("Usage: npx tsx scripts/import-tsv.ts <file.tsv>");
        process.exit(1);
    }

    const raw = readFileSync(file, "utf-8");
    const cards = parseTSV(raw);

    console.log(`Parsed ${cards.length} cards from ${file}`);

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const card of cards) {
        const frentePtNorm = normalizeFrentePt(card.frentePt);

        // Check dedup
        const existing = await prisma.card.findUnique({
            where: { frentePtNorm },
        });
        if (existing) {
            console.log(`  SKIP (dup): "${card.frentePt}"`);
            skipped++;
            continue;
        }

        // QA check
        const qa = qaCheck(card);
        const quality = qa.score > 0.7 ? "raw" : qa.score >= 0.4 ? "suspicious" : "rejected";

        if (quality === "rejected") {
            console.log(`  REJECT: "${card.frentePt}" — QA: ${qa.score.toFixed(2)} — ${qa.flags.join(", ")}`);
            failed++;
            continue;
        }

        await prisma.card.create({
            data: {
                tipo: card.tipo,
                contexto: card.contexto,
                frentePt: card.frentePt,
                frentePtNorm,
                notaGlobal: card.notaGlobal || "",
                objetivo: card.objetivo || "",
                nivel: card.nivel as "a1" | "a2" | "b1" | "b2" | "c1",
                categoria: card.categoria as "pedido",
                source: "import_tsv",
                quality,
                blocos: {
                    create: card.idiomas.map((b) => ({
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

        const status = quality === "suspicious" ? "⚠️" : "✅";
        console.log(`  ${status} "${card.frentePt}" — QA: ${qa.score.toFixed(2)}`);
        imported++;
    }

    console.log(`\nDone: ${imported} imported, ${skipped} skipped, ${failed} rejected`);
    await prisma.$disconnect();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
