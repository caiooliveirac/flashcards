import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
    const total = await p.card.count();
    const missingCount = await p.card.count({ where: { notaGlobal: "" } });

    console.log(`Total cards: ${total}`);
    console.log(`Missing notaGlobal: ${missingCount}`);

    const samples = await p.card.findMany({
        where: { notaGlobal: "" },
        take: 5,
        orderBy: { seq: "asc" },
        select: { seq: true, frentePt: true, objetivo: true, notaGlobal: true },
    });

    for (const s of samples) {
        console.log(`  seq=${s.seq}: "${s.frentePt}" | notaGlobal="${s.notaGlobal}" | objetivo="${s.objetivo}"`);
    }

    await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
