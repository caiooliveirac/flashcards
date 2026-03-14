"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import FilterBar from "@/components/FilterBar";
import QualityBadge from "@/components/QualityBadge";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const QUALITY_OPTIONS = ["raw", "reviewed", "edited", "gold", "suspicious", "deprecated"];
const SORT_OPTIONS = [
    { value: "newest", label: "Mais recente" },
    { value: "oldest", label: "Mais antigo" },
    { value: "qa_worst", label: "Pior QA" },
];

interface CardPreview {
    id: string;
    seq: number;
    frentePt: string;
    nivel: string;
    categoria: string;
    quality: string;
    idiomasPrincipais: string[];
    blocos?: { langCode: string; natural: string }[];
    tags?: { tag: { name: string } }[];
    _count?: { blocos: number; reviews: number };
    createdAt?: string;
}

interface Filters {
    lang?: string;
    tier?: string;
    nivel?: string;
    q?: string;
}

export default function BrowsePage() {
    const [cards, setCards] = useState<CardPreview[]>([]);
    const [filters, setFilters] = useState<Filters>({});
    const [quality, setQuality] = useState<string>("");
    const [sort, setSort] = useState("newest");
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    const fetchCards = useCallback(async (pageNum: number, append = false) => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        if (filters.nivel) params.set("nivel", filters.nivel);
        if (filters.tier) params.set("tier", filters.tier);
        if (filters.lang) params.set("lang", filters.lang);
        if (quality) params.set("quality", quality);
        params.set("sort", sort);
        params.set("page", String(pageNum));
        params.set("limit", "20");

        const res = await fetch(`${BASE}/api/cards?${params}`);
        const data = await res.json();

        const list = data.cards || [];
        setCards((prev) => (append ? [...prev, ...list] : list));
        setTotal(data.total || 0);
        setHasMore(list.length >= 20);
        setLoading(false);
    }, [filters, quality, sort]);

    useEffect(() => {
        setPage(1);
        fetchCards(1);
    }, [fetchCards]);

    const loadMore = () => {
        const next = page + 1;
        setPage(next);
        fetchCards(next, true);
    };

    return (
        <div className="space-y-4 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Explorar Cards</h2>
                <span className="text-xs text-zinc-400">{total} cards</span>
            </div>

            <FilterBar filters={filters} onChange={setFilters} showSearch />

            {/* Quality + Sort row */}
            <div className="flex gap-2 items-center">
                <div className="flex gap-1 overflow-x-auto no-scrollbar flex-1">
                    <button onClick={() => setQuality("")}
                        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium transition-all ${!quality ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"}`}>
                        Tudo
                    </button>
                    {QUALITY_OPTIONS.map(q => (
                        <button key={q} onClick={() => setQuality(quality === q ? "" : q)}
                            className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium transition-all ${quality === q ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"}`}>
                            {q}
                        </button>
                    ))}
                </div>
                <select value={sort} onChange={e => setSort(e.target.value)}
                    className="bg-zinc-700 rounded-lg px-2 py-1 text-[10px] outline-none shrink-0">
                    {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            {/* Results */}
            {loading && cards.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="text-3xl">🌀</motion.div>
                </div>
            ) : cards.length === 0 ? (
                <div className="py-16 text-center">
                    <p className="text-4xl mb-2">🔍</p>
                    <p className="text-gray-500">Nenhum card encontrado</p>
                </div>
            ) : (
                <div className="space-y-2">
                    <AnimatePresence>
                        {cards.map((card, i) => (
                            <motion.div key={card.id}
                                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(i * 0.03, 0.3) }}>
                                <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 space-y-2">
                                    <Link href={`/card/${card.id}`} className="block">
                                        <div className="flex items-start gap-3">
                                            <span className="mt-0.5 shrink-0 text-xs font-mono text-gray-600">#{card.seq}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium leading-snug truncate">{card.frentePt}</p>
                                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-[10px] uppercase text-gray-500">{card.nivel}</span>
                                                    <span className="text-gray-700">·</span>
                                                    <span className="text-[10px] text-gray-500 capitalize">{card.categoria.replace(/_/g, " ")}</span>
                                                    <QualityBadge quality={card.quality} />
                                                </div>
                                                {/* Tier S preview */}
                                                {card.blocos && card.blocos.length > 0 && (
                                                    <div className="mt-1.5 space-y-0.5">
                                                        {card.blocos.slice(0, 3).map(b => (
                                                            <p key={b.langCode} className="text-[10px] text-zinc-400 truncate">
                                                                <span className="text-zinc-500 font-medium">{b.langCode}</span> {b.natural}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Tags */}
                                                {card.tags && card.tags.length > 0 && (
                                                    <div className="mt-1 flex gap-1 flex-wrap">
                                                        {card.tags.map(t => (
                                                            <span key={t.tag.name} className="text-[9px] bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-400">
                                                                {t.tag.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="mt-1 text-xs text-gray-600">→</span>
                                        </div>
                                    </Link>
                                    {/* Action buttons */}
                                    <div className="flex gap-2 border-t border-zinc-700/50 pt-2">
                                        <Link href={`/study?card=${card.id}`}
                                            className="text-[10px] text-blue-400 hover:underline">Estudar agora</Link>
                                        <Link href={`/card/${card.id}/edit`}
                                            className="text-[10px] text-yellow-400 hover:underline">Editar</Link>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {hasMore && (
                        <button onClick={loadMore} disabled={loading}
                            className="tap-scale w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] py-3 text-sm font-medium text-gray-400 active:bg-white/5">
                            {loading ? "Carregando..." : "Carregar mais"}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
