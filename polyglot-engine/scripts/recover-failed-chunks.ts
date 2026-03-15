/**
 * Audit script: check failed GenerationJobs.
 *
 * For each failed job:
 *  1. Checks if a Card already exists with that frentePt (already saved — skip).
 *  2. If not, checks if GenerationBatch rows have rawResponse persisted.
 *  3. If they do, attempts to re-parse the raw JSON with the sanitizer.
 *  4. Reports what can be recovered vs. what needs to be re-generated.
 *
 * Usage: npx tsx scripts/recover-failed-chunks.ts
 */

import { PrismaClient } from "@prisma/client";
import { normalizeFrentePt } from "../src/lib/normalize";

const prisma = new PrismaClient();

// ─── JSON sanitizer (same logic as generator.ts) ─────────────────────────────

function sanitizeJson(text: string): string {
    let result = "";
    let inString = false;
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (inString) {
            if (ch === "\\" && i + 1 < text.length) {
                result += ch + text[i + 1];
                i += 2;
                continue;
            }
            if (ch === '"') {
                const rest = text.substring(i + 1).trimStart();
                if (
                    rest.length === 0 ||
                    rest[0] === "," || rest[0] === "}" || rest[0] === "]" ||
                    rest[0] === ":"
                ) {
                    result += ch;
                    inString = false;
                } else {
                    result += '\\"';
                }
                i++;
                continue;
            }
            if (ch === "\n") { result += "\\n"; i++; continue; }
            if (ch === "\r") { result += "\\r"; i++; continue; }
            if (ch === "\t") { result += "\\t"; i++; continue; }
            result += ch;
        } else {
            if (ch === '"') { inString = true; }
            result += ch;
        }
        i++;
    }
    result = result.replace(/,(\s*[}\]])/g, "$1");
    return result;
}

function tryParse(raw: string): { ok: boolean; obj?: unknown; method?: string } {
    try { return { ok: true, obj: JSON.parse(raw), method: "direct" }; } catch { /* fall */ }
    const cleaned = sanitizeJson(raw);
    try { return { ok: true, obj: JSON.parse(cleaned), method: "sanitized" }; } catch { /* fall */ }
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
        try { return { ok: true, obj: JSON.parse(match[0]), method: "regex+sanitized" }; } catch { /* fall */ }
    }
    return { ok: false };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const failedJobs = await prisma.generationJob.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "asc" },
        include: { batches: { select: { family: true, rawResponse: true, status: true, langsGenerated: true } } },
    });

    console.log(`\n=== Failed jobs: ${failedJobs.length} ===\n`);

    let alreadySaved = 0;
    let canRecover = 0;
    let needsReGen = 0;

    for (const job of failedJobs) {
        const norm = normalizeFrentePt(job.chunkPt);

        // 1. Check if card already exists
        const existingCard = await prisma.card.findUnique({
            where: { frentePtNorm: norm },
            select: { id: true, seq: true, quality: true },
        });

        if (existingCard) {
            alreadySaved++;
            console.log(`✅ ALREADY SAVED  | #${existingCard.seq} | "${job.chunkPt}"`);
            continue;
        }

        // 2. Check batch raw responses
        const batchesWithRaw = job.batches.filter(b => b.rawResponse && b.rawResponse.length > 10);
        const batchCount = job.batches.length;
        const rawCount = batchesWithRaw.length;

        if (rawCount === 0) {
            needsReGen++;
            console.log(`❌ NO RAW DATA    | "${job.chunkPt}" | error: ${job.error?.substring(0, 60)}`);
            continue;
        }

        // 3. Try to parse each batch's raw response
        const parseResults: string[] = [];
        let allParseable = true;

        for (const batch of job.batches) {
            if (!batch.rawResponse) {
                parseResults.push(`  ${batch.family}: NO RAW`);
                allParseable = false;
                continue;
            }
            const r = tryParse(batch.rawResponse);
            if (r.ok) {
                parseResults.push(`  ${batch.family}: OK (${r.method})`);
            } else {
                parseResults.push(`  ${batch.family}: STILL FAILS`);
                allParseable = false;
            }
        }

        if (allParseable && rawCount === batchCount) {
            canRecover++;
            console.log(`🔧 RECOVERABLE   | "${job.chunkPt}" | ${rawCount}/${batchCount} batches`);
        } else {
            const status = rawCount < batchCount ? `only ${rawCount}/${batchCount} batches have raw` : "some batches still fail parse";
            needsReGen++;
            console.log(`⚠️  PARTIAL       | "${job.chunkPt}" | ${status}`);
        }
        for (const r of parseResults) console.log(r);
    }

    console.log(`
=== Summary ===
✅ Already in DB (card exists): ${alreadySaved}
🔧 Recoverable (all raw data ok): ${canRecover}
❌ Needs re-generation: ${needsReGen}
`);

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
