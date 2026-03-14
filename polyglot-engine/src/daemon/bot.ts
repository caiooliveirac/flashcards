import { Bot } from "grammy";

const API_BASE = "http://localhost:3000";

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!token) {
    console.log("[BOT] No TELEGRAM_BOT_TOKEN set. Bot disabled.");
    process.exit(0);
}

const bot = new Bot(token);

async function api(path: string, opts?: RequestInit) {
    const res = await fetch(`${API_BASE}${path}`, opts);
    return res.json();
}

function fmt(n: number, decimals = 0): string {
    return n.toLocaleString("pt-BR", { maximumFractionDigits: decimals });
}

function fmtUsd(n: number): string {
    return `$${n.toFixed(3)}`;
}

function fmtDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

function fmtUptime(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${minutes}min`;
}

// ─── /status ───
bot.command("status", async (ctx) => {
    try {
        const data = await api("/api/generate/status");
        const d = data.daemon;
        const q = data.queue;
        const t = data.generation.today;
        const a = data.generation.all_time;

        const statusIcon = d.enabled ? "🟢" : "🔴";
        const statusText = d.enabled ? "Ativo" : "Pausado";
        const interval = d.interval_ms / 1000;

        const cacheHit = t.total_input_tokens > 0
            ? Math.round((t.total_cached_tokens / t.total_input_tokens) * 100)
            : 0;

        const qualityParts = Object.entries(a.by_quality || {})
            .map(([k, v]) => `${v} ${k}`)
            .join(", ");

        const msg = [
            `${statusIcon} Daemon ${statusText} | Intervalo: ${interval}s`,
            "",
            `📊 Hoje:`,
            `  ✅ ${t.total} gerados (${t.success} ok, ${t.suspicious} ⚠️, ${t.failed} ❌)`,
            `  💰 ${fmtUsd(t.total_cost_usd)} | 🎯 QA médio: ${(t.avg_qa_score || 0).toFixed(2)}`,
            `  📥 ${fmt(t.total_input_tokens)}in | 📤 ${fmt(t.total_output_tokens)}out | 💾 ${fmt(t.total_cached_tokens)} cache`,
            "",
            `📦 Fila: ${q.pending} pendentes | ${q.generated} gerados | ${q.variations_available} variações`,
            "",
            `🏆 Total: ${a.total_cards} cards (${qualityParts})`,
        ].join("\n");

        await ctx.reply(msg);
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /ultimo ───
bot.command("ultimo", async (ctx) => {
    try {
        const data = await api("/api/generate?limit=1&status=done");
        const job = data.jobs?.[0];
        if (!job) {
            await ctx.reply("Nenhum job concluído ainda.");
            return;
        }

        const lines = [
            `✅ "${job.chunkPt}"`,
            `📅 ${new Date(job.createdAt).toLocaleString("pt-BR")} | ⏱ ${fmtDuration(job.duration_ms || 0)} | 💰 ${fmtUsd(job.cost || 0)}`,
            `🎯 QA: ${(job.qa?.score || 0).toFixed(2)}`,
            "",
            "Batches:",
        ];

        for (const b of job.batches || []) {
            const icon = b.status === "ok" ? "✅" : "❌";
            lines.push(`  ${b.family}: ${icon} ${fmt(b.input_tokens)}in/${fmt(b.output_tokens)}out (cache: ${fmt(b.cached_tokens)}) — ${fmtDuration(b.duration_ms)}`);
        }

        if (job.qa?.checks?.checks) {
            lines.push("", "QA Checks:");
            for (const c of job.qa.checks.checks) {
                const icon = c.passed ? "✅" : "⚠️";
                lines.push(`  ${icon} ${c.detail}`);
            }
        }

        await ctx.reply(lines.join("\n"));
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /erros ───
bot.command("erros", async (ctx) => {
    try {
        const arg = ctx.match?.trim();

        if (arg) {
            // Show specific job
            const data = await api(`/api/generate/jobs/${arg}`);
            if (data.error) { await ctx.reply(`Job não encontrado: ${arg}`); return; }

            const lines = [
                `❌ "${data.chunkPt}"`,
                `Status: ${data.status}`,
                `Erro: ${data.error || "N/A"}`,
                "",
                "Batches:",
            ];
            for (const b of data.batches || []) {
                const icon = b.status === "ok" ? "✅" : "❌";
                lines.push(`  ${b.family}: ${icon} ${b.error || "OK"}`);
            }
            if (data.rawTsv) {
                lines.push("", "TSV (truncado):", data.rawTsv.substring(0, 500));
            }
            await ctx.reply(lines.join("\n"));
        } else {
            // List last 5 failed
            const data = await api("/api/generate?limit=5&status=failed");
            if (!data.jobs?.length) { await ctx.reply("Nenhum erro recente."); return; }

            const lines = ["❌ Últimos erros:", ""];
            for (const j of data.jobs) {
                lines.push(`• "${j.chunkPt}" — ${new Date(j.createdAt).toLocaleString("pt-BR")}`);
                lines.push(`  ${j.qa?.flags?.join(", ") || "Erro de API"}`);
            }
            await ctx.reply(lines.join("\n"));
        }
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /custo ───
bot.command("custo", async (ctx) => {
    try {
        const data = await api("/api/generate/status");
        const t = data.generation.today;
        const a = data.generation.all_time;

        const todayCards = t.total;
        const avgCost = todayCards > 0 ? t.total_cost_usd / todayCards : 0;
        const cacheHit = t.total_input_tokens > 0
            ? Math.round((t.total_cached_tokens / t.total_input_tokens) * 100)
            : 0;

        const msg = [
            "💰 Custos:",
            `  Hoje: ${fmtUsd(t.total_cost_usd)} (${todayCards} cards)`,
            `  Total: ${fmtUsd(a.total_cost_usd)} (${a.total_cards} cards)`,
            "",
            `  Média: ${fmtUsd(avgCost)}/card`,
            `  Cache hit: ${cacheHit}%`,
        ].join("\n");

        await ctx.reply(msg);
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /qa ───
bot.command("qa", async (ctx) => {
    try {
        const data = await api("/api/generate?limit=50");
        const jobs = data.jobs || [];
        const doneJobs = jobs.filter((j: { qa: unknown }) => j.qa);

        if (doneJobs.length === 0) { await ctx.reply("Nenhum job com QA."); return; }

        const scores = doneJobs.map((j: { qa: { score: number } }) => j.qa.score);
        const avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const passed = doneJobs.filter((j: { qa: { passed: boolean } }) => j.qa.passed).length;
        const suspicious = doneJobs.filter((j: { qa: { score: number } }) => j.qa.score <= 0.7 && j.qa.score >= 0.4).length;
        const rejected = doneJobs.filter((j: { qa: { score: number } }) => j.qa.score < 0.4).length;

        // Count flag frequencies
        const flagCounts = new Map<string, number>();
        for (const j of doneJobs) {
            for (const f of (j as { qa: { flags: string[] } }).qa.flags) {
                flagCounts.set(f, (flagCounts.get(f) ?? 0) + 1);
            }
        }
        const topFlags = [...flagCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const lines = [
            `📋 QA últimos ${doneJobs.length} cards:`,
            `  Score médio: ${avgScore.toFixed(2)}`,
            `  ✅ ${passed} passed | ⚠️ ${suspicious} suspicious | ❌ ${rejected} rejected`,
        ];

        if (topFlags.length > 0) {
            lines.push("", "  Flags mais comuns:");
            for (const [flag, count] of topFlags) {
                lines.push(`  • ${flag} (${count}x)`);
            }
        }

        await ctx.reply(lines.join("\n"));
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /card [seq] ───
bot.command("card", async (ctx) => {
    try {
        const arg = ctx.match?.trim();
        if (!arg) { await ctx.reply("Uso: /card <seq>"); return; }

        // Find card by seq
        const cardsData = await api(`/api/cards?q=&page=1&limit=200`);
        const card = cardsData.cards?.find((c: { seq: number }) => c.seq === parseInt(arg));
        if (!card) { await ctx.reply(`Card #${arg} não encontrado.`); return; }

        // Get full card
        const fullCard = await api(`/api/cards/${card.id}`);

        const tierS = ["DE", "EN", "FR", "IT", "ES"];
        const lines = [
            `📇 #${String(fullCard.seq).padStart(3, "0")} "${fullCard.frentePt}"`,
            `Tipo: ${fullCard.tipo} | Qualidade: ${fullCard.quality}`,
            `Categoria: ${fullCard.categoria} | Nível: ${fullCard.nivel}`,
            "",
            "Tier S:",
        ];

        for (const lang of tierS) {
            const bloco = fullCard.blocos?.find((b: { langCode: string }) => b.langCode === lang);
            if (bloco) {
                const flag = { DE: "🇩🇪", EN: "🇬🇧", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸" }[lang] || "";
                lines.push(`  ${flag} ${bloco.natural}`);
            }
        }

        const otherCount = (fullCard.blocos?.length || 0) - tierS.filter(l =>
            fullCard.blocos?.some((b: { langCode: string }) => b.langCode === l)
        ).length;
        if (otherCount > 0) lines.push(`\n  + ${otherCount} outros idiomas`);

        await ctx.reply(lines.join("\n"));
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /fila ───
bot.command("fila", async (ctx) => {
    try {
        const arg = ctx.match?.trim() || "";

        // /fila add
        if (arg.startsWith("add")) {
            const rest = arg.substring(3).trim();
            // Parse flags: -c categoria -n nivel -p prioridade
            let chunkText = rest;
            let categoria = "pedido";
            let nivel = "a1";
            let prioridade = 0;

            const flagRegex = /-([cnp])\s+(\S+)/g;
            let match;
            while ((match = flagRegex.exec(rest)) !== null) {
                if (match[1] === "c") categoria = match[2];
                else if (match[1] === "n") nivel = match[2];
                else if (match[1] === "p") prioridade = parseInt(match[2]) || 0;
                chunkText = chunkText.replace(match[0], "").trim();
            }

            if (!chunkText) { await ctx.reply("Uso: /fila add <chunk>"); return; }

            const res = await api("/api/generate/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chunkPt: chunkText, categoria, nivel, prioridade }),
            });

            if (res.error) {
                await ctx.reply(`⚠️ ${typeof res.error === "string" ? res.error : "Chunk já existe"}`);
            } else {
                await ctx.reply([
                    `✅ Adicionado: "${chunkText}"`,
                    `  Categoria: ${categoria} | Nível: ${nivel} | Prioridade: ${prioridade}`,
                ].join("\n"));
            }
            return;
        }

        // /fila remover [id]
        if (arg.startsWith("remover")) {
            const id = arg.substring(7).trim();
            if (!id) { await ctx.reply("Uso: /fila remover <id>"); return; }
            await api(`/api/generate/queue/${id}`, { method: "DELETE" });
            await ctx.reply(`🗑 Chunk removido.`);
            return;
        }

        // /fila priorizar [id] [prioridade]
        if (arg.startsWith("priorizar")) {
            const parts = arg.substring(9).trim().split(/\s+/);
            if (parts.length < 2) { await ctx.reply("Uso: /fila priorizar <id> <prioridade>"); return; }
            await api(`/api/generate/queue/${parts[0]}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prioridade: parseInt(parts[1]) || 0 }),
            });
            await ctx.reply(`✅ Prioridade atualizada.`);
            return;
        }

        // Default: show queue
        const data = await api("/api/generate/queue");
        const sq = data.static_queue;
        const vq = data.variation_queue;

        const lines = [
            "📋 Fila de chunks:",
            `  Pendentes: ${sq.pending.length} | Gerados: ${sq.generated.length} | Variações: ${vq.available}`,
            "",
            "  Próximos 10:",
        ];

        const pending = sq.pending.slice(0, 10);
        pending.forEach((c: { chunkPt: string; nivel: string; categoria: string; prioridade: number }, i: number) => {
            lines.push(`  ${i + 1}. [P${c.prioridade}] "${c.chunkPt}" (${c.nivel}, ${c.categoria})`);
        });

        if (pending.length === 0) lines.push("  (vazia)");

        await ctx.reply(lines.join("\n"));
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /gerar [chunk] ───
bot.command("gerar", async (ctx) => {
    try {
        const chunk = ctx.match?.trim();
        if (!chunk) { await ctx.reply("Uso: /gerar <chunk em português>"); return; }

        const res = await api("/api/generate/queue", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chunkPt: chunk, categoria: "pedido", nivel: "a1", prioridade: 999 }),
        });

        if (res.error) {
            await ctx.reply(`⚠️ ${typeof res.error === "string" ? res.error : "Chunk já existe"}`);
        } else {
            await ctx.reply(`⏳ Chunk enfileirado com prioridade máxima. Será gerado no próximo tick (~2min).`);
        }
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /pausar ───
bot.command("pausar", async (ctx) => {
    try {
        await api("/api/generate/toggle", { method: "POST" });
        await ctx.reply("⏸ Daemon pausado.");
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /retomar ───
bot.command("retomar", async (ctx) => {
    try {
        await api("/api/generate/toggle", { method: "POST" });
        await ctx.reply("▶️ Daemon retomado.");
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

// ─── /importar ───
// Usage:
//   /importar Quanto custa isso?
//   langCode=DE | natural=Was kostet das? | ...
//   ||
//   langCode=EN | natural=How much does this cost? | ...
//
// First line after the command is the chunkPt.
// Everything else is the raw TSV output from Opus.
// Optional flags on chunk line: -c categoria -n nivel -x contexto
bot.command("importar", async (ctx) => {
    try {
        const raw = ctx.message?.text ?? "";
        // Remove "/importar " prefix
        const body = raw.replace(/^\/importar\s*/i, "").trim();

        if (!body || !body.includes("langCode=")) {
            await ctx.reply([
                "📥 Uso do /importar:",
                "",
                "/importar Quanto custa isso?",
                "langCode=DE | natural=Was kostet das? | literal=... | ...",
                "||",
                "langCode=EN | natural=How much? | ...",
                "",
                "Flags opcionais na 1ª linha:",
                "  -c categoria  -n nivel  -x contexto",
                "",
                "Cole o output completo do Opus (formato pipe).",
            ].join("\n"));
            return;
        }

        // Split: first line = chunkPt (+ optional flags), rest = TSV
        const lines = body.split("\n");
        let chunkLine = lines[0].trim();
        const tsvPart = lines.slice(1).join("\n").trim();

        if (!tsvPart || !tsvPart.includes("langCode=")) {
            // Maybe everything is on a single paste — chunk might be before first langCode
            const firstLang = body.indexOf("langCode=");
            if (firstLang > 0) {
                chunkLine = body.substring(0, firstLang).trim();
                const tsv = body.substring(firstLang).trim();
                await processImport(ctx, chunkLine, tsv);
                return;
            }
            await ctx.reply("❌ Não encontrei blocos langCode= no texto. Cole o output do Opus após o chunk.");
            return;
        }

        await processImport(ctx, chunkLine, tsvPart);
    } catch (err) {
        await ctx.reply(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
});

async function processImport(ctx: { reply: (text: string) => Promise<unknown> }, chunkLine: string, tsv: string) {
    // Parse optional flags from chunk line
    let categoria: string | undefined;
    let nivel: string | undefined;
    let contexto: string | undefined;

    // Extract -c flag
    const cMatch = chunkLine.match(/-c\s+(\S+)/);
    if (cMatch) { categoria = cMatch[1]; chunkLine = chunkLine.replace(cMatch[0], "").trim(); }

    // Extract -n flag
    const nMatch = chunkLine.match(/-n\s+(\S+)/);
    if (nMatch) { nivel = nMatch[1]; chunkLine = chunkLine.replace(nMatch[0], "").trim(); }

    // Extract -x flag (contexto — rest until next flag or end)
    const xMatch = chunkLine.match(/-x\s+"([^"]+)"/);
    if (xMatch) { contexto = xMatch[1]; chunkLine = chunkLine.replace(xMatch[0], "").trim(); }

    const chunkPt = chunkLine.trim();
    if (!chunkPt) {
        await ctx.reply("❌ Chunk (frase em PT) não encontrado. Coloque na primeira linha após /importar.");
        return;
    }

    await ctx.reply(`⏳ Importando "${chunkPt}"... Processando ${tsv.split("||").length} blocos.`);

    const data = await api("/api/cards/import-tsv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkPt, tsv, contexto, nivel, categoria }),
    });

    if (data.error) {
        await ctx.reply(`❌ ${data.error}`);
        return;
    }

    const c = data.card;
    const msg = [
        `✅ Card #${c.seq} criado!`,
        `📝 "${c.frentePt}"`,
        `🏷 Quality: ${c.quality} | QA: ${c.qaScore.toFixed(2)}`,
        `🌐 ${c.langsImported} idiomas importados`,
    ];
    if (c.langsMissing > 0) {
        msg.push(`⚠️ ${c.langsMissing} idiomas faltando: ${c.missingLangs?.join(", ")}`);
    }
    if (c.qaFlags?.length > 0) {
        msg.push(`🚩 Flags: ${c.qaFlags.join(", ")}`);
    }
    await ctx.reply(msg.join("\n"));
}

// ─── /help ───
bot.command(["help", "start"], async (ctx) => {
    await ctx.reply([
        "🤖 PolyGlot Bot",
        "",
        "📊 Observabilidade:",
        "  /status — Estado do daemon + métricas",
        "  /ultimo — Último card gerado",
        "  /erros — Últimos 5 erros",
        "  /erros <id> — Detalhe de um job",
        "  /custo — Custos de geração",
        "  /qa — Análise de qualidade",
        "  /card <seq> — Ver card completo",
        "",
        "📋 Fila:",
        "  /fila — Ver fila de chunks",
        "  /fila add <chunk> — Adicionar chunk",
        "  /fila add -c cat -n nivel -p prio <chunk>",
        "  /fila remover <id> — Remover chunk",
        "  /fila priorizar <id> <prio>",
        "",
        "📥 Importação:",
        "  /importar <chunk> — Cola output do Opus",
        "    Flags: -c categoria -n nivel -x \"contexto\"",
        "",
        "⚙️ Controle:",
        "  /gerar <chunk> — Gera com prioridade máxima",
        "  /pausar — Pausa o daemon",
        "  /retomar — Retoma o daemon",
    ].join("\n"));
});

// Start the bot
console.log("[BOT] Starting Telegram bot...");
bot.start({
    onStart: () => console.log("[BOT] Telegram bot started successfully"),
});
