/**
 * curate-cards.ts — Curadoria periódica de cards
 *
 * Roda um conjunto de "curadores" em sequência e produz um relatório.
 * Seguro para rodar N vezes — todas as correções são idempotentes.
 *
 * Uso:
 *   npx tsx scripts/curate-cards.ts          # diagnóstico + correções automáticas
 *   npx tsx scripts/curate-cards.ts --dry    # só audita, sem alterar nada
 *   npx tsx scripts/curate-cards.ts --fix=categoria,idiomas   # só curadoresped
 *
 * Para rodar como cron (ex: todo dia às 3h):
 *   0 3 * * * cd /home/ubuntu/flashcards/polyglot-engine && npx tsx scripts/curate-cards.ts >> logs/curate.log 2>&1
 */

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.find(a => a.startsWith("--fix="))?.replace("--fix=", "").split(",");

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const LANG_CODES = [
    "DE", "EN", "FR", "IT", "ES",
    "JA", "KO", "ZH", "RU", "AR",
    "SV", "NO", "NL", "DA", "FI",
    "BCS", "HU", "CS", "PL", "TR",
    "TH", "VI", "HE", "EL", "ID",
] as const;

const TIER_MAP: Record<string, string[]> = {
    S: ["DE", "EN", "FR", "IT", "ES"],
    A: ["JA", "KO", "ZH", "RU", "AR"],
    B: ["SV", "NO", "NL", "DA", "FI"],
    C: ["BCS", "HU", "CS", "PL", "TR"],
    D: ["TH", "VI", "HE", "EL", "ID"],
};

// Regras para detecção automática de categoria
const CATEGORIA_RULES: Array<{ cat: string; keywords: string[] }> = [
    { cat: "apresentacao", keywords: ["bom dia", "boa tarde", "boa noite", "prazer", "meu nome", "tudo bem", "tudo bom", "como vai", "identidade", "apresenta"] },
    { cat: "polidez", keywords: ["por favor", "desculpe", "com licença", "obrigad", "gentileza", "poderia", "faz favor"] },
    { cat: "reparo_conversacional", keywords: ["repeti", "repetir", "não entend", "pode falar", "mais devagar", "como assim", "repair"] },
    { cat: "direcao", keywords: ["onde fica", "como eu cheg", "caminho", "direcao", "direção", "localiz", "endereço", "rota", "virar", "dobrar"] },
    { cat: "transporte", keywords: ["ônibus", "onibus", "trem", "táxi", "taxi", "carro", "estação", "metrô", "metro", "ticket", "bilhete", "passagem", "ponto de ônibus", "próxima parada", "aeroporto"] },
    { cat: "emergencia", keywords: ["emergência", "emergencia", "polícia", "policia", "socorro", "urgente", "911", "acidente", "fogo", "incêndio", "incendio", "roubo", "ambulância"] },
    { cat: "trabalho", keywords: ["trabalh", "profissão", "profissao", "escritório", "escritorio", "carreira", "empresa", "emprego", "ocupação", "ocupacao", "negocio", "negócio", "reunião"] },
    { cat: "socializacao", keywords: ["tempo livre", "hobby", "irmã", "irmão", "família", "familia", "amig", "gosto de", "namorando", "casado", "filhos", "fim de semana", "passatempo"] },
    { cat: "comida", keywords: ["restaurante", "comida", "prato", "refeição", "refeicao", "almoço", "almoco", "jantar", "café com leite", "cafe com leite", "café da manhã", "sobremesa", "cardápio", "cardapio", "vegetarian"] },
    { cat: "hospedagem", keywords: ["hotel", "hóspede", "hospede", "quarto", "reserva", "check-in", "checkout", "café da manhã", "ar-condicionado", "toalha", "andar"] },
    { cat: "compras", keywords: ["quanto custa", "preço", "preco", "cartão", "cartao", "dinheiro", "desconto", "pagar", "comprar", "troco", "nota", "à vista", "a vista", "parcelado", "promoção"] },
    { cat: "saude", keywords: ["alérgico", "alergico", "doença", "doenca", "sintoma", "saúde", "saude", "alergia", "médico", "medico", "hospital", "remédio", "remedio", "dor", "febre", "receita"] },
    { cat: "tempo", keywords: ["que horas", "hora", "minuto", "amanhã", "ontem", "hoje", "quando", "relógio", "relogio", "às três", "as tres", "cedo", "tarde"] },
    { cat: "numeros", keywords: ["número", "numero", "digit", "cardinal", "ordinal", "contar", "zero", "bilhete número", "primeiro", "segundo", "terceiro"] },
    { cat: "sentimentos", keywords: ["feliz", "triste", "raiva", "medo", "amor", "ódio", "odio", "sentimento", "emoção", "emocao", "saudade", "preocupado", "ansioso", "nervoso"] },
    { cat: "opiniao", keywords: ["acho que", "penso que", "opinião", "opiniao", "concordo", "discordo", "na minha opinião", "na minha visão", "ponto de vista"] },
    { cat: "comparacao", keywords: ["mais do que", "menos do que", "melhor que", "pior que", "igual", "diferente", "contraste", "comparação", "comparacao"] },
    { cat: "descricao", keywords: ["comprido", "alto", "baixo", "gordo", "magro", "cor", "tamanho", "descrição", "descricao", "aparência", "aparencia", "formato"] },
    { cat: "rotina", keywords: ["toda manhã", "toda tarde", "acordar", "dormir", "durmo", "levanto", "rotina", "costume", "habito", "hábito", "frequentemente", "sempre", "nunca"] },
];

type IssueLevel = "error" | "warning" | "info";
type IssueCode =
    | "CATEGORIA_PEDIDO_DEFAULT"
    | "IDIOMASPRINCIPAIS_NULL"
    | "IDIOMASPRINCIPAIS_INCOMPLETE"
    | "IDIOMASPRINCIPAIS_OUTDATED"
    | "NOTA_GLOBAL_EMPTY"
    | "OBJETIVO_EMPTY"
    | "CONTEXTO_VAGUE"
    | "BLOCOS_MISSING"
    | "BLOCO_NATURAL_EMPTY"
    | "BLOCO_ROMANIZACAO_MISSING"
    | "QUALITY_SUSPICIOUS_EMPTY";

interface Issue {
    cardId: string;
    cardSeq: number;
    frentePt: string;
    code: IssueCode;
    level: IssueLevel;
    details: string;
    autoFix?: () => Promise<void>;
}

// ─── RELATÓRIO ───────────────────────────────────────────────────────────────

const issues: Issue[] = [];
let fixed = 0;
let skipped = 0;

function addIssue(issue: Issue) {
    issues.push(issue);
}

// ─── CURADORES ───────────────────────────────────────────────────────────────

/**
 * Curador 1: Categoria
 * Detecta cards com categoria=pedido que poderiam ser melhor classificados.
 * Também detecta cards com categoria não-pedido que possam estar erradas.
 */
async function curateCategoria() {
    console.log("\n[1/6] Auditando categorias...");

    const cards = await p.card.findMany({
        select: { id: true, seq: true, frentePt: true, contexto: true, objetivo: true, categoria: true },
        orderBy: { seq: "asc" },
    });

    for (const card of cards) {
        const detected = detectCategoria(card);

        if (card.categoria === "pedido" && detected !== "pedido") {
            addIssue({
                cardId: card.id,
                cardSeq: card.seq,
                frentePt: card.frentePt,
                code: "CATEGORIA_PEDIDO_DEFAULT",
                level: "warning",
                details: `categoria=pedido mas detecção sugere "${detected}"`,
                autoFix: async () => {
                    await p.card.update({
                        where: { id: card.id },
                        data: { categoria: detected as any },
                    });
                },
            });
        }
    }

    console.log(`  Cards analisados: ${cards.length}`);
    return cards.length;
}

/**
 * Curador 2: idiomasPrincipais
 * - null → preenche com todos os langCodes dos blocos existentes
 * - desatualizado → sincroniza com os blocos reais
 */
async function curateIdiomasPrincipais() {
    console.log("\n[2/6] Auditando idiomasPrincipais...");

    // Cards com null
    const nullCards = await p.$queryRaw<{ id: string; seq: number; frentePt: string }[]>`
        SELECT id, seq, "frentePt" FROM "Card" 
        WHERE "idiomasPrincipais" IS NULL OR array_length("idiomasPrincipais", 1) IS NULL
    `;

    for (const card of nullCards) {
        addIssue({
            cardId: card.id,
            cardSeq: card.seq,
            frentePt: card.frentePt,
            code: "IDIOMASPRINCIPAIS_NULL",
            level: "error",
            details: "idiomasPrincipais é null",
            autoFix: async () => {
                const blocos = await p.langBloco.findMany({
                    where: { cardId: card.id },
                    select: { langCode: true },
                });
                const langs = blocos.map(b => b.langCode);
                if (langs.length > 0) {
                    await p.card.update({
                        where: { id: card.id },
                        data: { idiomasPrincipais: langs },
                    });
                }
            },
        });
    }

    // Cards com idiomasPrincipais desatualizado (não bate com blocos reais)
    const allCards = await p.card.findMany({
        where: { idiomasPrincipais: { isEmpty: false } },
        select: {
            id: true,
            seq: true,
            frentePt: true,
            idiomasPrincipais: true,
            blocos: { select: { langCode: true } },
        },
    }) as Array<{ id: string; seq: number; frentePt: string; idiomasPrincipais: string[]; blocos: { langCode: string }[] }>;

    for (const card of allCards) {
        const blocoLangs = new Set(card.blocos.map(b => b.langCode));
        const currentLangs = new Set(card.idiomasPrincipais);

        // Verifica se há discrepância
        const missingInIP = [...blocoLangs].filter(l => !currentLangs.has(l));
        const extraInIP = [...currentLangs].filter(l => !blocoLangs.has(l));

        if (missingInIP.length > 0 || extraInIP.length > 0) {
            const correctLangs = [...blocoLangs].sort();
            addIssue({
                cardId: card.id,
                cardSeq: card.seq,
                frentePt: card.frentePt,
                code: "IDIOMASPRINCIPAIS_OUTDATED",
                level: "warning",
                details: `idiomasPrincipais desatualizado. Faltando: [${missingInIP.join(",")}] Extra: [${extraInIP.join(",")}]`,
                autoFix: async () => {
                    await p.card.update({
                        where: { id: card.id },
                        data: { idiomasPrincipais: correctLangs },
                    });
                },
            });
        }

        // Card com menos de 25 blocos
        if (blocoLangs.size < LANG_CODES.length) {
            const missingLangs = LANG_CODES.filter(l => !blocoLangs.has(l));
            addIssue({
                cardId: card.id,
                cardSeq: card.seq,
                frentePt: card.frentePt,
                code: "BLOCOS_MISSING",
                level: "error",
                details: `Tem ${blocoLangs.size}/25 blocos. Faltando: ${missingLangs.join(", ")}`,
                // Sem autoFix — requer regeneração via generator
            });
        }
    }

    console.log(`  Cards com IP nulo: ${nullCards.length}`);
    console.log(`  Cards com IP desatualizado: ${allCards.filter(c => {
        const b = new Set(c.blocos.map(b => b.langCode));
        const ip = new Set(c.idiomasPrincipais);
        return [...b].some(l => !ip.has(l)) || [...ip].some(l => !b.has(l));
    }).length}`);
}

/**
 * Curador 3: notaGlobal e objetivo
 * Flags cards com campos obrigatórios vazios/placeholder.
 */
async function curateNotaGlobal() {
    console.log("\n[3/6] Auditando notaGlobal e objetivo...");

    const emptyNota = await p.card.findMany({
        where: { OR: [{ notaGlobal: "" }, { notaGlobal: "—" }] },
        select: { id: true, seq: true, frentePt: true, contexto: true },
    });

    for (const card of emptyNota) {
        addIssue({
            cardId: card.id,
            cardSeq: card.seq,
            frentePt: card.frentePt,
            code: "NOTA_GLOBAL_EMPTY",
            level: "error",
            details: "notaGlobal está vazio — card precisa de regeneração ou curadoria manual",
        });
    }

    const emptyObjetivo = await p.card.findMany({
        where: { OR: [{ objetivo: "" }, { objetivo: "—" }] },
        select: { id: true, seq: true, frentePt: true },
    });

    for (const card of emptyObjetivo) {
        addIssue({
            cardId: card.id,
            cardSeq: card.seq,
            frentePt: card.frentePt,
            code: "OBJETIVO_EMPTY",
            level: "warning",
            details: "objetivo está vazio",
        });
    }

    const vagueContexto = await p.card.findMany({
        where: {
            OR: [
                { contexto: "conversa do dia a dia" },
                { contexto: "comércio" },
                { contexto: "" },
                { contexto: "—" },
            ]
        },
        select: { id: true, seq: true, frentePt: true, contexto: true },
    });

    for (const card of vagueContexto) {
        addIssue({
            cardId: card.id,
            cardSeq: card.seq,
            frentePt: card.frentePt,
            code: "CONTEXTO_VAGUE",
            level: "info",
            details: `contexto muito vago: "${card.contexto}"`,
        });
    }

    console.log(`  notaGlobal vazia: ${emptyNota.length}`);
    console.log(`  objetivo vazio: ${emptyObjetivo.length}`);
    console.log(`  contexto vago: ${vagueContexto.length}`);
}

/**
 * Curador 4: Blocos individuais
 * Verifica campos obrigatórios em LangBloco.
 */
async function curateBlocos() {
    console.log("\n[4/6] Auditando blocos de idioma...");

    const NON_LATIN = ["JA", "KO", "ZH", "RU", "AR", "TH", "HE", "EL"];

    // Blocos com natural vazio
    const emptyNatural = await p.langBloco.findMany({
        where: { OR: [{ natural: "" }, { natural: "—" }] },
        select: { cardId: true, langCode: true, card: { select: { seq: true, frentePt: true } } },
    }) as Array<{ cardId: string; langCode: string; card: { seq: number; frentePt: string } }>;

    for (const b of emptyNatural) {
        addIssue({
            cardId: b.cardId,
            cardSeq: b.card.seq,
            frentePt: b.card.frentePt,
            code: "BLOCO_NATURAL_EMPTY",
            level: "error",
            details: `Bloco ${b.langCode}: campo 'natural' vazio`,
        });
    }

    // Blocos não-latinos sem romanização
    const missingRoman = await p.langBloco.findMany({
        where: {
            langCode: { in: NON_LATIN },
            OR: [{ romanizacao: "" }, { romanizacao: "—" }],
        },
        select: { cardId: true, langCode: true, card: { select: { seq: true, frentePt: true } } },
    }) as Array<{ cardId: string; langCode: string; card: { seq: number; frentePt: string } }>;

    for (const b of missingRoman) {
        addIssue({
            cardId: b.cardId,
            cardSeq: b.card.seq,
            frentePt: b.card.frentePt,
            code: "BLOCO_ROMANIZACAO_MISSING",
            level: "warning",
            details: `Bloco ${b.langCode} (não-latino) sem romanização`,
        });
    }

    console.log(`  Blocos com 'natural' vazio: ${emptyNatural.length}`);
    console.log(`  Blocos não-latinos sem romanização: ${missingRoman.length}`);
}

/**
 * Curador 5: Quality
 * Marca como 'suspicious' cards que tem sinais de problema.
 */
async function curateQuality() {
    console.log("\n[5/6] Auditando quality...");

    // Cards com notaGlobal vazio e quality=raw não marcados como suspicious
    const problematic = await p.card.findMany({
        where: {
            quality: { in: ["raw"] },
            OR: [
                { notaGlobal: "" },
                { objetivo: "" },
            ],
        },
        select: { id: true, seq: true, frentePt: true, quality: true },
    });

    for (const card of problematic) {
        const hasBlocos = await p.langBloco.count({ where: { cardId: card.id } });
        if (hasBlocos < 10) {
            addIssue({
                cardId: card.id,
                cardSeq: card.seq,
                frentePt: card.frentePt,
                code: "QUALITY_SUSPICIOUS_EMPTY",
                level: "warning",
                details: `quality=${card.quality} mas tem < 10 blocos (${hasBlocos}) e campos vazios — candidato a suspicious`,
                autoFix: async () => {
                    await p.card.update({
                        where: { id: card.id },
                        data: { quality: "suspicious" },
                    });
                },
            });
        }
    }

    console.log(`  Cards potencialmente suspicious: ${problematic.length}`);
}

/**
 * Curador 6: Consistência geral (stats)
 */
async function curateStats() {
    console.log("\n[6/6] Coletando estatísticas gerais...");

    const total = await p.card.count();
    const byQuality = await p.$queryRaw<{ quality: string; cnt: number }[]>`
        SELECT quality, COUNT(*)::int as cnt FROM "Card" GROUP BY quality ORDER BY cnt DESC
    `;
    const byCategoria = await p.$queryRaw<{ categoria: string; cnt: number }[]>`
        SELECT categoria, COUNT(*)::int as cnt FROM "Card" GROUP BY categoria ORDER BY cnt DESC
    `;
    const byNivel = await p.$queryRaw<{ nivel: string; cnt: number }[]>`
        SELECT nivel, COUNT(*)::int as cnt FROM "Card" GROUP BY nivel ORDER BY cnt DESC
    `;
    const totalBlocos = await p.langBloco.count();
    const blocosByLang = await p.$queryRaw<{ langCode: string; cnt: number }[]>`
        SELECT "langCode", COUNT(*)::int as cnt FROM "LangBloco" GROUP BY "langCode" ORDER BY "langCode"
    `;

    console.log(`\n  Total cards: ${total}`);
    console.log(`  Total blocos: ${totalBlocos} (esperado: ${total * 25})`);
    console.log(`  Por quality: ${byQuality.map(q => `${q.quality}=${q.cnt}`).join(" | ")}`);
    console.log(`  Por nível:   ${byNivel.map(n => `${n.nivel}=${n.cnt}`).join(" | ")}`);
    console.log(`\n  Por categoria:`);
    byCategoria.forEach(c => {
        const pct = ((c.cnt / total) * 100).toFixed(0);
        const bar = "█".repeat(Math.floor(Number(pct) / 5));
        console.log(`    ${c.categoria.padEnd(25)} ${String(c.cnt).padStart(4)} (${pct.padStart(2)}%) ${bar}`);
    });

    // Verifica cobertura de each lang
    const expectedPerLang = total;
    const problemLangs = blocosByLang.filter(b => b.cnt < expectedPerLang);
    if (problemLangs.length > 0) {
        console.log(`\n  ⚠️  Langs com cobertura incompleta:`);
        problemLangs.forEach(b => console.log(`    ${b.langCode}: ${b.cnt}/${expectedPerLang}`));
    } else {
        console.log(`\n  ✓ Todos os 25 idiomas têm cobertura completa (${expectedPerLang} blocos cada)`);
    }
}

// ─── HELPER: detecção de categoria ───────────────────────────────────────────

function detectCategoria(card: { frentePt: string; contexto: string; objetivo: string | null }): string {
    const text = (
        card.frentePt + " " +
        (card.contexto || "") + " " +
        (card.objetivo || "")
    ).toLowerCase();

    const scores: Record<string, number> = {};
    for (const rule of CATEGORIA_RULES) {
        scores[rule.cat] = rule.keywords.filter(kw => text.includes(kw)).length;
    }

    const entries = Object.entries(scores).filter(([, v]) => v > 0);
    if (entries.length === 0) return "pedido";

    // Em caso de empate, usa precedência da lista (mais específico primeiro)
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
}

// ─── RUNNER ──────────────────────────────────────────────────────────────────

async function applyCurators() {
    const shouldRun = (name: string) => !ONLY || ONLY.includes(name);

    if (shouldRun("categoria")) await curateCategoria();
    if (shouldRun("idiomas")) await curateIdiomasPrincipais();
    if (shouldRun("nota")) await curateNotaGlobal();
    if (shouldRun("blocos")) await curateBlocos();
    if (shouldRun("quality")) await curateQuality();
    if (shouldRun("stats")) await curateStats();
}

async function applyFixes() {
    console.log("\n─── Aplicando correções automáticas ───────────────────────────");

    const fixable = issues.filter(i => i.autoFix);
    const byCode: Record<string, Issue[]> = {};
    for (const issue of fixable) {
        byCode[issue.code] = byCode[issue.code] ?? [];
        byCode[issue.code].push(issue);
    }

    for (const [code, batch] of Object.entries(byCode)) {
        console.log(`\n  ${code}: ${batch.length} correções`);
        for (const issue of batch) {
            try {
                if (!DRY) {
                    await issue.autoFix!();
                    fixed++;
                } else {
                    skipped++;
                }
                if (!DRY) console.log(`    ✓ #${issue.cardSeq}: ${issue.details}`);
                else console.log(`    ~ #${issue.cardSeq}: [DRY] ${issue.details}`);
            } catch (err) {
                console.error(`    ✗ #${issue.cardSeq}: ${err}`);
            }
        }
    }
}

function printReport() {
    const errors = issues.filter(i => i.level === "error");
    const warnings = issues.filter(i => i.level === "warning");
    const infos = issues.filter(i => i.level === "info");

    console.log("\n══════════════════════════════════════════════════");
    console.log("  RELATÓRIO DE CURADORIA");
    console.log(`  Data: ${new Date().toISOString()}`);
    console.log("══════════════════════════════════════════════════");
    console.log(`\n  🔴 Erros:     ${errors.length}`);
    console.log(`  🟡 Warnings:  ${warnings.length}`);
    console.log(`  🔵 Infos:     ${infos.length}`);
    console.log(`  ✅ Auto-fixed: ${fixed}`);
    if (DRY) console.log(`  📋 Skipped (--dry): ${skipped}`);

    // Detalhes por nível
    for (const [label, list] of [
        ["ERROS", errors],
        ["WARNINGS", warnings],
    ] as const) {
        if (list.length === 0) continue;

        console.log(`\n─── ${label} ────────────────────────────────────`);
        // Agrupa por código
        const grouped: Record<string, Issue[]> = {};
        for (const i of list as Issue[]) {
            grouped[i.code] = grouped[i.code] ?? [];
            grouped[i.code].push(i);
        }
        for (const [code, batch] of Object.entries(grouped)) {
            const fixedCount = batch.filter(i => i.autoFix).length;
            console.log(`\n  [${code}] — ${batch.length} ocorrências (${fixedCount} auto-fix)`);
            batch.slice(0, 5).forEach(i => {
                console.log(`    #${i.cardSeq} "${i.frentePt.substring(0, 50).trim()}"`);
                console.log(`       → ${i.details}`);
            });
            if (batch.length > 5) {
                console.log(`    ... e mais ${batch.length - 5} ocorrências`);
            }
        }
    }

    if (infos.length > 0) {
        console.log(`\n─── INFOS (${infos.length}) ─── (use --verbose para ver todos)`);
    }

    console.log("\n══════════════════════════════════════════════════\n");
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║  curate-cards.ts — Curadoria de Cards            ║");
    console.log(`║  Modo: ${DRY ? "DRY RUN (sem alterações)" : "LIVE (aplicando correções)"}${" ".repeat(DRY ? 0 : 7)}  ║`);
    console.log("╚══════════════════════════════════════════════════╝");

    try {
        await applyCurators();
        if (!DRY) await applyFixes();
        printReport();
    } finally {
        await p.$disconnect();
    }

    // Exit code 1 se houver erros não corrigidos
    const unresolvedErrors = issues.filter(i => i.level === "error" && !i.autoFix);
    if (unresolvedErrors.length > 0) {
        console.error(`\n${unresolvedErrors.length} erros requerem intervenção manual.`);
        process.exit(1);
    }
    process.exit(0);
}

main().catch(e => {
    console.error("Erro fatal:", e);
    process.exit(1);
});
