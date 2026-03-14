"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type ChunkItem = {
    chunkPt: string;
    categoria?: string;
    nivel?: string;
    grammarFocus?: string[];
    teaches?: string;
};

const CATEGORY_OPTIONS = [
    { value: "apresentacao", label: "Apresentação" },
    { value: "polidez", label: "Polidez" },
    { value: "reparo_conversacional", label: "Reparo" },
    { value: "pedido", label: "Pedido" },
    { value: "direcao", label: "Direção" },
    { value: "transporte", label: "Transporte" },
    { value: "emergencia", label: "Emergência" },
    { value: "trabalho", label: "Trabalho" },
    { value: "socializacao", label: "Socialização" },
    { value: "comida", label: "Comida" },
    { value: "hospedagem", label: "Hospedagem" },
    { value: "compras", label: "Compras" },
    { value: "saude", label: "Saúde" },
    { value: "tempo", label: "Tempo" },
    { value: "numeros", label: "Números" },
    { value: "sentimentos", label: "Sentimentos" },
    { value: "opiniao", label: "Opinião" },
    { value: "comparacao", label: "Comparação" },
    { value: "descricao", label: "Descrição" },
    { value: "rotina", label: "Rotina" },
];

const LEVELS = ["a1", "a2", "b1", "b2", "c1"];

export default function QueuePage() {
    const [queue, setQueue] = useState<ChunkItem[]>([]);
    const [newChunk, setNewChunk] = useState("");
    const [category, setCategory] = useState("pedido");
    const [level, setLevel] = useState("a1");
    const [grammarFocus, setGrammarFocus] = useState("");
    const [teaches, setTeaches] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/generate/queue`)
            .then((r) => r.json())
            .then((d) => {
                const pending = (d.static_queue?.pending ?? []) as any[];
                setQueue(
                    pending.map((item) => ({
                        chunkPt: item.chunkPt,
                        categoria: item.categoria,
                        nivel: item.nivel,
                        grammarFocus: item.grammarFocus ?? item.grammar_focus,
                        teaches: item.teaches,
                    }))
                );
                setLoading(false);
            });
    }, []);

    async function addChunk() {
        if (!newChunk.trim()) return;
        const payload: any = {
            chunkPt: newChunk.trim(),
            categoria: category,
            nivel: level,
        };
        if (grammarFocus.trim()) {
            payload.grammar_focus = grammarFocus.split(",").map((s) => s.trim()).filter(Boolean);
        }
        if (teaches.trim()) {
            payload.teaches = teaches.trim();
        }

        const res = await fetch(`${BASE}/api/generate/queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) return;

        setQueue((q) => [
            ...q,
            {
                chunkPt: newChunk.trim(),
                categoria: category,
                nivel: level,
                grammarFocus: payload.grammar_focus,
                teaches: payload.teaches,
            },
        ]);
        setNewChunk("");
        setGrammarFocus("");
        setTeaches("");
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="px-4 py-6 space-y-6">
            <h1 className="text-2xl font-bold">📋 Fila de Chunks</h1>

            {/* Add chunk */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-2">
                    <input
                        type="text"
                        value={newChunk}
                        onChange={(e) => setNewChunk(e.target.value)}
                        placeholder="Novo chunk em português..."
                        className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <div className="flex gap-2">
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="flex-1 bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {CATEGORY_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={level}
                            onChange={(e) => setLevel(e.target.value)}
                            className="w-32 bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {LEVELS.map((lvl) => (
                                <option key={lvl} value={lvl}>
                                    {lvl.toUpperCase()}
                                </option>
                            ))}
                        </select>
                    </div>

                    <input
                        type="text"
                        value={grammarFocus}
                        onChange={(e) => setGrammarFocus(e.target.value)}
                        placeholder="Foco gramatical (vírgula separa)"
                        className="w-full bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <textarea
                        value={teaches}
                        onChange={(e) => setTeaches(e.target.value)}
                        placeholder="Teaches (objetivo didático)"
                        rows={3}
                        className="w-full resize-none bg-zinc-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                        onClick={addChunk}
                        disabled={!newChunk.trim()}
                        className="w-full px-4 py-2 bg-blue-600 rounded-xl font-semibold text-sm disabled:opacity-50"
                    >
                        Adicionar
                    </button>
                </div>
            </div>

            {/* Queue list */}
            <div className="space-y-2">
                {queue.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Fila vazia.</p>
                ) : (
                    queue.map((chunk, i) => (
                        <motion.div
                            key={`${chunk.chunkPt}-${i}`}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="bg-zinc-800 rounded-xl px-4 py-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm">
                                        <span className="text-zinc-500 mr-2">#{i + 1}</span>
                                        {chunk.chunkPt}
                                    </p>
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {chunk.categoria ?? "-"} • {chunk.nivel?.toUpperCase() ?? "-"}
                                    </p>
                                </div>
                                <div className="text-right text-xs text-zinc-500">
                                    {chunk.grammarFocus?.length ? chunk.grammarFocus.join(", ") : ""}
                                </div>
                            </div>
                            {chunk.teaches ? (
                                <p className="mt-2 text-xs text-zinc-400">🎯 {chunk.teaches}</p>
                            ) : null}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
