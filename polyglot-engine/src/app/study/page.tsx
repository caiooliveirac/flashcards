"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import StudyCard from "@/components/StudyCard";
import RatingButtons from "@/components/RatingButtons";
import FilterBar from "@/components/FilterBar";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Filters {
    lang?: string;
    tier?: string;
}

interface CardData {
    id: string;
    seq: number;
    contexto: string;
    frentePt: string;
    notaGlobal: string;
    objetivo: string;
    nivel: string;
    categoria: string;
    quality: string;
    idiomasPrincipais: string[];
    blocos: Array<Record<string, unknown>>;
    difficulties?: Array<{ langCode: string; level: string; types: string[] }>;
}

interface DueItem {
    cardId: string;
    card: CardData;
}

export default function StudyPage() {
    const [cards, setCards] = useState<CardData[]>([]);
    const [index, setIndex] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [rating, setRating] = useState(false);
    const [filters, setFilters] = useState<Filters>({});
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ done: 0, total: 0 });
    const [showFilters, setShowFilters] = useState(false);

    const fetchDue = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (filters.lang) params.set("lang", filters.lang);
        if (filters.tier) params.set("tier", filters.tier);
        params.set("limit", "30");

        const res = await fetch(`${BASE}/api/study/due?${params}`);
        const data = await res.json();

        // Merge due + new into a single queue
        const dueCards: CardData[] = (data.due || []).map((d: DueItem) => d.card);
        const newCards: CardData[] = data.new || [];
        // Dedup by id
        const seen = new Set<string>();
        const merged: CardData[] = [];
        for (const c of [...dueCards, ...newCards]) {
            if (!seen.has(c.id)) {
                seen.add(c.id);
                merged.push(c);
            }
        }

        setCards(merged);
        setIndex(0);
        setRevealed(false);
        setRating(false);
        setStats({ done: 0, total: merged.length });
        setLoading(false);
    }, [filters]);

    useEffect(() => {
        fetchDue();
    }, [fetchDue]);

    const current = cards[index];

    const handleRate = async (r: number) => {
        if (!current || rating) return;
        setRating(true);

        await fetch(`${BASE}/api/study/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cardId: current.id,
                langCode: filters.lang || null,
                rating: r,
            }),
        });

        const newDone = stats.done + 1;
        setStats((s) => ({ ...s, done: newDone }));

        // Brief pause then next card
        setTimeout(() => {
            if (index < cards.length - 1) {
                setIndex((i) => i + 1);
                setRevealed(false);
                setRating(false);
            } else {
                setCards([]);
            }
        }, 300);
    };

    const handleDifficulty = async (langCode: string, level: string, types: string[]) => {
        if (!current) return;
        await fetch(`${BASE}/api/cards/${current.id}/difficulty`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ langCode, level, types }),
        });
        // Optimistic update
        setCards((prev) =>
            prev.map((c) =>
                c.id === current.id
                    ? {
                        ...c,
                        difficulties: [
                            ...(c.difficulties || []).filter((d) => d.langCode !== langCode),
                            { langCode, level, types },
                        ],
                    }
                    : c
            )
        );
    };

    // Empty state
    if (!loading && cards.length === 0) {
        return (
            <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-6xl"
                >
                    {stats.done > 0 ? "🎉" : "🌅"}
                </motion.div>
                <h2 className="text-xl font-bold text-center">
                    {stats.done > 0
                        ? `Parabéns! ${stats.done} cards revisados!`
                        : "Nenhum card disponível"}
                </h2>
                <p className="text-sm text-gray-500 text-center">
                    {stats.done > 0
                        ? "Volte mais tarde para reforçar."
                        : "Adicione cards ou ajuste os filtros."}
                </p>
                <button
                    onClick={fetchDue}
                    className="tap-scale mt-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white"
                >
                    Atualizar
                </button>
            </div>
        );
    }

    return (
        <div className="flex min-h-[calc(100dvh-60px)] flex-col safe-bottom">
            {/* Top bar — progress + filter toggle */}
            <div className="flex items-center justify-between px-1 py-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                        {stats.done}/{stats.total}
                    </span>
                    <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                            className="h-full bg-green-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{
                                width: stats.total > 0
                                    ? `${(stats.done / stats.total) * 100}%`
                                    : "0%",
                            }}
                        />
                    </div>
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`tap-scale rounded-lg px-3 py-1.5 text-xs font-medium ${showFilters ? "bg-blue-600 text-white" : "bg-white/5 text-gray-400"
                        }`}
                >
                    🎛️ Filtros
                </button>
            </div>

            {/* Collapsible filters */}
            <AnimatePresence>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="pb-2">
                            <FilterBar
                                filters={filters}
                                onChange={(f) => {
                                    setFilters(f);
                                    setShowFilters(false);
                                }}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Loading */}
            {loading && (
                <div className="flex flex-1 items-center justify-center">
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="text-3xl"
                    >
                        🌀
                    </motion.div>
                </div>
            )}

            {/* Card area */}
            {!loading && current && (
                <div className="flex flex-1 flex-col">
                    <div className="flex-1 overflow-y-auto pb-4">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={current.id}
                                initial={{ opacity: 0, x: 50 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50 }}
                                transition={{ duration: 0.25 }}
                            >
                                <StudyCard
                                    card={current as Parameters<typeof StudyCard>[0]["card"]}
                                    onReveal={() => setRevealed(true)}
                                    onDifficulty={handleDifficulty}
                                    focusLang={filters.lang}
                                />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Rating buttons — fixed at bottom */}
                    {revealed && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="sticky bottom-0 bg-[var(--background)]/95 backdrop-blur-sm pt-2 pb-2"
                        >
                            <RatingButtons onRate={handleRate} disabled={rating} />
                        </motion.div>
                    )}
                </div>
            )}
        </div>
    );
}
