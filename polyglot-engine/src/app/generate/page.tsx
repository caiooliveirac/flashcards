"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───

interface Batch {
    family: string;
    status: string;
    input_tokens: number;
    output_tokens: number;
    cached_tokens: number;
    cost_usd: number;
    duration_ms: number;
    langs_generated: string[];
    error: string | null;
}

interface QACheck { name: string; passed: boolean; detail: string; }

interface Job {
    id: string;
    chunkPt: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    duration_ms: number | null;
    cost: number | null;
    cardId: string | null;
    batches: Batch[];
    qa: { score: number; passed: boolean; flags: string[]; checks: { checks: QACheck[] } | null } | null;
    card_id: string | null;
}

interface DaemonStatus {
    daemon: {
        enabled: boolean;
        interval_ms: number;
        current_state: string;
        last_tick_at: string | null;
        next_tick_at: string | null;
    };
    queue: { total_chunks: number; pending: number; generated: number; failed: number; variations_available: number };
    generation: {
        today: { total: number; success: number; suspicious: number; failed: number; avg_qa_score: number; total_cost_usd: number; total_input_tokens: number; total_output_tokens: number; total_cached_tokens: number };
        all_time: { total_cards: number; by_quality: Record<string, number>; total_cost_usd: number };
    };
    last_5_jobs: Job[];
}

interface ChunkEntry {
    id: string;
    chunkPt: string;
    categoria: string;
    nivel: string;
    prioridade: number;
    gerado: boolean;
    grammarFocus?: string[] | null;
    teaches?: string | null;
}

interface FailedChunk {
    id: string;
    chunkPt: string;
    error: string | null;
    createdAt: string;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const CATEGORIAS = [
    "apresentacao", "polidez", "reparo_conversacional", "pedido",
    "direcao", "transporte", "emergencia", "trabalho", "socializacao",
    "comida", "hospedagem", "compras", "saude", "tempo", "numeros",
    "sentimentos", "opiniao", "comparacao", "descricao", "rotina",
];

const NIVEIS = ["a1", "a2", "b1", "b2", "c1"];

export default function GeneratePage() {
    const [status, setStatus] = useState<DaemonStatus | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsTotal, setJobsTotal] = useState(0);
    const [jobsPage, setJobsPage] = useState(1);
    const [jobsFilter, setJobsFilter] = useState("");
    const [queue, setQueue] = useState<ChunkEntry[]>([]);
    const [queueGenerated, setQueueGenerated] = useState<ChunkEntry[]>([]);
    const [queueFailed, setQueueFailed] = useState<FailedChunk[]>([]);
    const [queueTab, setQueueTab] = useState<"pending" | "generated" | "failed">("pending");

    // Input states
    const [newChunk, setNewChunk] = useState("");
    const [newCategoria, setNewCategoria] = useState("pedido");
    const [newNivel, setNewNivel] = useState("a1");
    const [newPrioridade, setNewPrioridade] = useState(0);
    const [newGrammarFocus, setNewGrammarFocus] = useState("");
    const [newTeaches, setNewTeaches] = useState("");
    const [bulkMode, setBulkMode] = useState(false);
    const [bulkJson, setBulkJson] = useState("");
    const [bulkError, setBulkError] = useState("");

    // Expanded job
    const [expandedJob, setExpandedJob] = useState<string | null>(null);

    // Countdown
    const [countdown, setCountdown] = useState<number | null>(null);

    const [submitting, setSubmitting] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch(`${BASE}/api/generate/status`);
            const data = await res.json();
            setStatus(data);
        } catch { /* ignore */ }
    }, []);

    const fetchJobs = useCallback(async () => {
        try {
            const params = new URLSearchParams({ page: String(jobsPage), limit: "20" });
            if (jobsFilter) params.set("status", jobsFilter);
            const res = await fetch(`${BASE}/api/generate?${params}`);
            const data = await res.json();
            setJobs(data.jobs ?? []);
            setJobsTotal(data.total ?? 0);
        } catch { /* ignore */ }
    }, [jobsPage, jobsFilter]);

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`${BASE}/api/generate/queue`);
            const data = await res.json();
            setQueue(data.static_queue?.pending ?? []);
            setQueueGenerated(data.static_queue?.generated ?? []);
            setQueueFailed(data.failed ?? []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        fetchStatus();
        fetchJobs();
        fetchQueue();
        const interval = setInterval(() => { fetchStatus(); fetchJobs(); }, 5000);
        return () => clearInterval(interval);
    }, [fetchStatus, fetchJobs, fetchQueue]);

    // Countdown timer
    useEffect(() => {
        if (!status?.daemon.next_tick_at) { setCountdown(null); return; }
        const update = () => {
            const diff = new Date(status.daemon.next_tick_at!).getTime() - Date.now();
            setCountdown(Math.max(0, Math.floor(diff / 1000)));
        };
        update();
        const t = setInterval(update, 1000);
        return () => clearInterval(t);
    }, [status?.daemon.next_tick_at]);

    async function toggleDaemon() {
        await fetch(`${BASE}/api/generate/toggle`, { method: "POST" });
        await fetchStatus();
    }

    async function submitChunk(priority?: number) {
        if (!newChunk.trim()) return;
        setSubmitting(true);
        await fetch(`${BASE}/api/generate/queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chunkPt: newChunk.trim(),
                categoria: newCategoria,
                nivel: newNivel,
                grammar_focus: newGrammarFocus
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean),
                teaches: newTeaches.trim() || undefined,
                prioridade: priority ?? newPrioridade,
            }),
        });
        setNewChunk("");
        setNewGrammarFocus("");
        setNewTeaches("");
        setSubmitting(false);
        await fetchQueue();
    }

    async function submitBulk() {
        setBulkError("");
        try {
            const parsed = JSON.parse(bulkJson);
            const chunks = Array.isArray(parsed) ? parsed : parsed.chunks;
            if (!Array.isArray(chunks)) { setBulkError("Formato inválido. Use array de {chunkPt, categoria, nivel, grammar_focus, teaches}."); return; }
            setSubmitting(true);
            await fetch(`${BASE}/api/generate/queue/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "merge", chunks }),
            });
            setBulkJson("");
            setSubmitting(false);
            await fetchQueue();
        } catch {
            setBulkError("JSON inválido.");
        }
    }

    async function deleteChunk(id: string) {
        if (!confirm("Remover este chunk?")) return;
        await fetch(`${BASE}/api/generate/queue/${id}`, { method: "DELETE" });
        await fetchQueue();
    }

    async function moveToTop(id: string) {
        await fetch(`${BASE}/api/generate/queue/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prioridade: 999 }),
        });
        await fetchQueue();
    }

    const d = status?.daemon;
    const t = status?.generation?.today;
    const q = status?.queue;

    const cacheHitPct = t && t.total_input_tokens > 0
        ? Math.round((t.total_cached_tokens / t.total_input_tokens) * 100)
        : 0;

    return (
        <div className="px-1 py-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">⚙️ Geração</h1>
                {d && (
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${d.enabled ? "bg-green-900/50 text-green-300" : "bg-red-900/50 text-red-300"
                        }`}>
                        {d.enabled ? "🟢 Ativo" : "🔴 Pausado"}
                    </span>
                )}
            </div>

            {/* Section 1: Daemon Status */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${d?.enabled ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                            <span className="font-semibold">{d?.current_state === "generating" ? "🟡 Gerando..." : d?.enabled ? "Idle" : "Pausado"}</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                            Intervalo: {d ? (d.interval_ms / 1000) : 0}s
                            {countdown !== null && countdown > 0 && (
                                <> • Próximo tick: <span className="text-blue-400 font-mono">{countdown}s</span></>
                            )}
                        </p>
                    </div>
                    <button onClick={toggleDaemon}
                        className={`px-3 py-1.5 rounded-xl font-semibold text-xs transition-colors ${d?.enabled ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                            }`}>
                        {d?.enabled ? "Pausar" : "Retomar"}
                    </button>
                </div>

                {/* Quick metrics */}
                {t && (
                    <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-zinc-700/50 rounded-xl p-2">
                            <p className="text-lg font-bold text-green-400">{t.total}</p>
                            <p className="text-[10px] text-zinc-400">Hoje</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-2">
                            <p className="text-lg font-bold text-yellow-400">${t.total_cost_usd.toFixed(2)}</p>
                            <p className="text-[10px] text-zinc-400">Custo</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-2">
                            <p className="text-lg font-bold text-blue-400">{(t.avg_qa_score || 0).toFixed(2)}</p>
                            <p className="text-[10px] text-zinc-400">QA médio</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-2">
                            <p className="text-lg font-bold text-purple-400">{cacheHitPct}%</p>
                            <p className="text-[10px] text-zinc-400">Cache</p>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Section 2: Add chunks */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Adicionar chunks</h2>
                    <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <input type="checkbox" checked={bulkMode} onChange={() => setBulkMode(!bulkMode)}
                            className="rounded bg-zinc-700 border-zinc-600" />
                        Bulk
                    </label>
                </div>

                {bulkMode ? (
                    <div className="space-y-2">
                        <textarea value={bulkJson} onChange={e => setBulkJson(e.target.value)}
                            placeholder='[{"chunkPt":"...", "categoria":"pedido", "nivel":"a1", "grammar_focus":["negation"], "teaches":"..."}]'
                            className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
                        {bulkError && <p className="text-xs text-red-400">{bulkError}</p>}
                        <button onClick={submitBulk} disabled={submitting}
                            className="w-full px-4 py-2 bg-blue-600 rounded-xl font-semibold text-sm disabled:opacity-50">
                            Enviar bulk
                        </button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <input type="text" value={newChunk} onChange={e => setNewChunk(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submitChunk()}
                            placeholder="Chunk em português..."
                            className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        <div className="grid grid-cols-3 gap-2">
                            <select value={newCategoria} onChange={e => setNewCategoria(e.target.value)}
                                className="bg-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none">
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <select value={newNivel} onChange={e => setNewNivel(e.target.value)}
                                className="bg-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none">
                                {NIVEIS.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
                            </select>
                            <input type="number" value={newPrioridade} onChange={e => setNewPrioridade(parseInt(e.target.value) || 0)}
                                className="bg-zinc-700 rounded-lg px-2 py-1.5 text-xs outline-none" placeholder="Prio" />
                        </div>
                        <input type="text" value={newGrammarFocus} onChange={e => setNewGrammarFocus(e.target.value)}
                            placeholder="Foco gramatical (separe por vírgulas)"
                            className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                        <textarea value={newTeaches} onChange={e => setNewTeaches(e.target.value)}
                            placeholder="Objetivo didático / teaches"
                            className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-20 resize-y" />
                        <div className="flex gap-2">
                            <button onClick={() => submitChunk()} disabled={submitting || !newChunk.trim()}
                                className="flex-1 px-4 py-2 bg-blue-600 rounded-xl font-semibold text-sm disabled:opacity-50">
                                Adicionar à fila
                            </button>
                            <button onClick={() => submitChunk(999)} disabled={submitting || !newChunk.trim()}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-xl font-semibold text-sm disabled:opacity-50">
                                Gerar agora 🚀
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>

            {/* Section 3: Queue */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Fila de chunks</h2>
                    <span className="text-xs text-zinc-400">{q?.pending ?? 0} pendentes</span>
                </div>
                <div className="flex gap-1">
                    {(["pending", "generated", "failed"] as const).map(tab => (
                        <button key={tab} onClick={() => setQueueTab(tab)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${queueTab === tab
                                ? (tab === "failed" ? "bg-red-600 text-white" : "bg-blue-600 text-white")
                                : "bg-zinc-700 text-zinc-400"
                                }`}>
                            {tab === "pending" ? `Pendentes (${queue.length})`
                                : tab === "generated" ? `Gerados (${queueGenerated.length})`
                                    : `Falhou (${queueFailed.length})`}
                        </button>
                    ))}
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                    {queueTab === "failed" ? (
                        <>
                            {queueFailed.map((f, i) => (
                                <div key={f.id} className="bg-red-900/20 border border-red-800/30 rounded-lg px-2 py-2 text-xs space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-zinc-500">{i + 1}.</span>
                                        <span className="truncate text-red-300">{f.chunkPt}</span>
                                    </div>
                                    {f.error && (
                                        <p className="text-[10px] text-red-400/70 truncate">🔴 {f.error}</p>
                                    )}
                                    <p className="text-[9px] text-zinc-500">{new Date(f.createdAt).toLocaleString("pt-BR")}</p>
                                </div>
                            ))}
                            {queueFailed.length === 0 && (
                                <p className="text-xs text-zinc-500 text-center py-2">Nenhuma falha</p>
                            )}
                        </>
                    ) : (
                        <>
                            {(queueTab === "pending" ? queue : queueGenerated).map((c, i) => (
                                <div key={c.id} className="bg-zinc-700/50 rounded-lg px-2 py-2 text-xs space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-zinc-500">{i + 1}.</span>
                                            <span className="truncate">{c.chunkPt}</span>
                                            <span className="text-[10px] bg-zinc-600 px-1 rounded">{c.nivel}</span>
                                            <span className="text-[10px] bg-zinc-600 px-1 rounded">{c.categoria}</span>
                                            {c.prioridade > 0 && <span className="text-[10px] text-orange-400">P{c.prioridade}</span>}
                                        </div>
                                        {queueTab === "pending" && (
                                            <div className="flex gap-1 ml-2 shrink-0">
                                                <button onClick={() => moveToTop(c.id)} className="text-blue-400 hover:text-blue-300" title="Mover para topo">⬆</button>
                                                <button onClick={() => deleteChunk(c.id)} className="text-red-400 hover:text-red-300" title="Remover">✕</button>
                                            </div>
                                        )}
                                    </div>
                                    {c.grammarFocus && c.grammarFocus.length > 0 && (
                                        <p className="text-[11px] text-zinc-300">FOCO: {c.grammarFocus.join(", ")}</p>
                                    )}
                                    {c.teaches && (
                                        <p className="text-[11px] text-zinc-400">🎯 {c.teaches}</p>
                                    )}
                                </div>
                            ))}
                            {(queueTab === "pending" ? queue : queueGenerated).length === 0 && (
                                <p className="text-xs text-zinc-500 text-center py-2">Vazia</p>
                            )}
                        </>
                    )}
                </div>
            </motion.div>

            {/* Section 4: Jobs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Jobs recentes</h2>
                    <span className="text-xs text-zinc-400">{jobsTotal} total</span>
                </div>
                {/* Filters */}
                <div className="flex gap-1">
                    {[{ label: "Todos", value: "" }, { label: "✅ OK", value: "done" }, { label: "⚠️ Susp.", value: "suspicious" }, { label: "❌ Falha", value: "failed" }].map(f => (
                        <button key={f.value} onClick={() => { setJobsFilter(f.value); setJobsPage(1); }}
                            className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${jobsFilter === f.value ? "bg-blue-600 text-white" : "bg-zinc-700 text-zinc-400"
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
                {/* Job list */}
                <div className="space-y-2">
                    {jobs.map(job => (
                        <div key={job.id} className="bg-zinc-700/50 rounded-xl overflow-hidden">
                            {/* Collapsed row */}
                            <button onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                                className="w-full flex items-center justify-between px-3 py-2 text-left">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="text-sm">
                                        {job.status === "done" && (job.qa && !job.qa.passed ? "⚠️" : "✅")}
                                        {job.status === "failed" && "❌"}
                                        {job.status === "running" && "⏳"}
                                        {job.status === "pending" && "🕐"}
                                    </span>
                                    <span className="text-xs truncate max-w-[40%]">&quot;{job.chunkPt}&quot;</span>
                                    {job.duration_ms && <span className="text-[10px] text-zinc-400">{(job.duration_ms / 1000).toFixed(1)}s</span>}
                                    {job.cost !== null && <span className="text-[10px] text-zinc-400">${job.cost.toFixed(3)}</span>}
                                </div>
                                {job.qa && (
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${job.qa.score > 0.7 ? "bg-green-900/50 text-green-300"
                                        : job.qa.score >= 0.4 ? "bg-yellow-900/50 text-yellow-300"
                                            : "bg-red-900/50 text-red-300"
                                        }`}>
                                        {job.qa.score.toFixed(2)}
                                    </span>
                                )}
                            </button>
                            {/* Expanded details */}
                            <AnimatePresence>
                                {expandedJob === job.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                                        <div className="px-3 pb-3 space-y-2">
                                            {/* Batches */}
                                            <p className="text-[10px] font-semibold text-zinc-300 uppercase">Batches</p>
                                            {job.batches.map(b => (
                                                <div key={b.family} className="flex items-center justify-between text-[10px]">
                                                    <div className="flex items-center gap-1">
                                                        <span>{b.status === "ok" ? "✅" : "❌"}</span>
                                                        <span className="text-zinc-300">{b.family}</span>
                                                    </div>
                                                    <div className="text-zinc-400 space-x-2">
                                                        <span>{b.input_tokens}in/{b.output_tokens}out</span>
                                                        <span>(cache: {b.cached_tokens})</span>
                                                        <span>{(b.duration_ms / 1000).toFixed(1)}s</span>
                                                        <span>${b.cost_usd.toFixed(3)}</span>
                                                    </div>
                                                </div>
                                            ))}
                                            {/* QA Checks */}
                                            {job.qa?.checks?.checks && (
                                                <>
                                                    <p className="text-[10px] font-semibold text-zinc-300 uppercase mt-2">QA Checks</p>
                                                    {job.qa.checks.checks.map((c: QACheck, i: number) => (
                                                        <div key={i} className="text-[10px] flex items-center gap-1">
                                                            <span>{c.passed ? "✅" : "⚠️"}</span>
                                                            <span className={c.passed ? "text-zinc-400" : "text-yellow-400"}>{c.detail}</span>
                                                        </div>
                                                    ))}
                                                </>
                                            )}
                                            {/* QA Flags */}
                                            {job.qa && job.qa.flags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {job.qa.flags.map(f => (
                                                        <span key={f} className="text-[9px] bg-yellow-900/40 text-yellow-300 px-1.5 py-0.5 rounded">{f}</span>
                                                    ))}
                                                </div>
                                            )}
                                            {/* Links */}
                                            <div className="flex gap-2 mt-2 text-[10px]">
                                                {job.card_id && (
                                                    <a href={`${BASE}/card/${job.card_id}`}
                                                        className="text-blue-400 hover:underline">Ver card</a>
                                                )}
                                                {job.card_id && job.qa && !job.qa.passed && (
                                                    <a href={`${BASE}/card/${job.card_id}/edit`}
                                                        className="text-orange-400 hover:underline">Editar card</a>
                                                )}
                                            </div>
                                            {/* Date */}
                                            <p className="text-[9px] text-zinc-500">
                                                {new Date(job.createdAt).toLocaleString("pt-BR")}
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    ))}
                    {jobs.length === 0 && <p className="text-zinc-500 text-xs text-center py-2">Nenhum job.</p>}
                </div>
                {/* Pagination */}
                {jobsTotal > 20 && (
                    <div className="flex justify-center gap-2 pt-2">
                        <button onClick={() => setJobsPage(p => Math.max(1, p - 1))} disabled={jobsPage <= 1}
                            className="px-3 py-1 rounded-lg bg-zinc-700 text-xs disabled:opacity-30">←</button>
                        <span className="text-xs text-zinc-400 py-1">{jobsPage}/{Math.ceil(jobsTotal / 20)}</span>
                        <button onClick={() => setJobsPage(p => p + 1)} disabled={jobsPage * 20 >= jobsTotal}
                            className="px-3 py-1 rounded-lg bg-zinc-700 text-xs disabled:opacity-30">→</button>
                    </div>
                )}
            </motion.div>

            {/* Section 5: Cost & Metrics Summary */}
            {status && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-zinc-800 rounded-2xl p-4 space-y-3">
                    <h2 className="font-semibold text-sm">Custos & Métricas</h2>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-zinc-700/50 rounded-xl p-3">
                            <p className="text-zinc-400">Total de cards</p>
                            <p className="text-xl font-bold">{status.generation.all_time.total_cards}</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-3">
                            <p className="text-zinc-400">Custo total</p>
                            <p className="text-xl font-bold text-yellow-400">${(status.generation.all_time.total_cost_usd).toFixed(2)}</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-3">
                            <p className="text-zinc-400">Fila pendente</p>
                            <p className="text-xl font-bold text-blue-400">{status.queue.pending}</p>
                        </div>
                        <div className="bg-zinc-700/50 rounded-xl p-3">
                            <p className="text-zinc-400">Variações disponíveis</p>
                            <p className="text-xl font-bold text-purple-400">{status.queue.variations_available}</p>
                        </div>
                    </div>
                    {/* Quality breakdown */}
                    <div className="space-y-1">
                        <p className="text-[10px] text-zinc-400 uppercase">Qualidade</p>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(status.generation.all_time.by_quality || {}).map(([k, v]) => (
                                <span key={k} className={`text-[10px] px-2 py-0.5 rounded ${k === "gold" ? "bg-amber-900/30 text-amber-300"
                                    : k === "raw" ? "bg-gray-600/30 text-gray-300"
                                        : k === "suspicious" ? "bg-orange-900/30 text-orange-300"
                                            : "bg-zinc-600/30 text-zinc-300"
                                    }`}>
                                    {v} {k}
                                </span>
                            ))}
                        </div>
                    </div>
                    {/* Avg cost/card */}
                    {status.generation.all_time.total_cards > 0 && (
                        <p className="text-xs text-zinc-400">
                            Média: ${(status.generation.all_time.total_cost_usd / status.generation.all_time.total_cards).toFixed(3)}/card
                        </p>
                    )}
                </motion.div>
            )}
        </div>
    );
}
