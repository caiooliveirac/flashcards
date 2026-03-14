"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

interface LangBloco {
    id: string;
    langCode: string;
    natural: string;
    romanizacao: string;
    literal: string;
    padrao: string;
    gramatica: string | null;
    obs: string;
    erroTipico: string;
    contraste: string;
    armadilha: string;
    padraoReutilizavel: string;
    gatilho: string;
    registro: string;
    sinonimos: string | null;
    antonimo: string | null;
    collocations: string | null;
    campoSemantico: string | null;
    registroVariacoes: string | null;
}

interface Card {
    id: string;
    seq: number;
    frentePt: string;
    contexto: string;
    notaGlobal: string | null;
    objetivo: string | null;
    nivel: string;
    categoria: string;
    quality: string;
    blocos: LangBloco[];
}

export default function CardEditPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
    const [card, setCard] = useState<Card | null>(null);
    const [editedBlocos, setEditedBlocos] = useState<Map<string, Partial<LangBloco>>>(new Map());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${BASE}/api/cards/${id}`)
            .then((r) => r.json())
            .then(setCard);
    }, [id]);

    function updateBloco(blocoId: string, field: string, value: string) {
        setEditedBlocos((prev) => {
            const next = new Map(prev);
            const existing = next.get(blocoId) ?? {};
            next.set(blocoId, { ...existing, [field]: value });
            return next;
        });
        setSaved(false);
    }

    async function save() {
        if (!card) return;
        setSaving(true);
        setError(null);

        try {
            // Update card quality to "edited"
            const res = await fetch(`${BASE}/api/cards/${id}/edit`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    quality: "edited",
                    editedBlocos: Object.fromEntries(editedBlocos),
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error ?? "Falha ao salvar");
            }

            setSaved(true);
            setEditedBlocos(new Map());
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erro desconhecido");
        } finally {
            setSaving(false);
        }
    }

    if (!card) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full" />
            </div>
        );
    }

    const EDITABLE_FIELDS = [
        "natural", "romanizacao", "literal", "padrao", "gramatica",
        "obs", "erroTipico", "contraste", "armadilha", "padraoReutilizavel",
        "gatilho", "registro", "sinonimos", "antonimo", "collocations",
        "campoSemantico", "registroVariacoes",
    ] as const;

    return (
        <div className="px-4 py-6 space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">✏️ Editar Card #{card.seq}</h1>
                <button
                    onClick={save}
                    disabled={saving || editedBlocos.size === 0}
                    className="px-4 py-2 bg-green-600 rounded-xl font-semibold text-sm disabled:opacity-50 transition-all active:scale-95"
                >
                    {saving ? "Salvando..." : saved ? "✓ Salvo" : "Salvar"}
                </button>
            </div>

            {error && (
                <div className="bg-red-900/50 text-red-300 px-4 py-2 rounded-xl text-sm">
                    {error}
                </div>
            )}

            <div className="bg-zinc-800 rounded-2xl p-4">
                <p className="text-lg font-medium">{card.frentePt}</p>
                <p className="text-sm text-zinc-400 mt-1">{card.contexto}</p>
            </div>

            {/* Blocos editables */}
            <div className="space-y-4">
                {card.blocos.map((bloco, i) => (
                    <motion.div
                        key={bloco.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="bg-zinc-800 rounded-2xl p-4 space-y-3"
                    >
                        <h3 className="font-bold text-blue-400">{bloco.langCode}</h3>
                        {EDITABLE_FIELDS.map((field) => {
                            const currentValue =
                                editedBlocos.get(bloco.id)?.[field] ??
                                (bloco[field as keyof LangBloco] as string | null) ??
                                "";
                            return (
                                <div key={field}>
                                    <label className="text-xs text-zinc-500 block mb-1">
                                        {field}
                                    </label>
                                    <textarea
                                        value={currentValue}
                                        onChange={(e) =>
                                            updateBloco(bloco.id, field, e.target.value)
                                        }
                                        rows={1}
                                        className="w-full bg-zinc-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-blue-500 resize-y min-h-[32px]"
                                    />
                                </div>
                            );
                        })}
                    </motion.div>
                ))}
            </div>

            {/* Floating save button */}
            {editedBlocos.size > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="fixed bottom-20 left-0 right-0 flex justify-center z-50"
                >
                    <button
                        onClick={save}
                        disabled={saving}
                        className="px-6 py-3 bg-green-600 rounded-2xl font-bold shadow-lg shadow-green-900/50 active:scale-95 transition-transform"
                    >
                        {saving ? "Salvando..." : `Salvar (${editedBlocos.size} idiomas)`}
                    </button>
                </motion.div>
            )}
        </div>
    );
}
