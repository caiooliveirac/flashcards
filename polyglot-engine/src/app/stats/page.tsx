"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Stats {
    totalCards: number;
    dueNow: number;
    reviewsToday: number;
    qualityBreakdown: Array<{ quality: string; _count: number }>;
    categoryBreakdown: Array<{ categoria: string; _count: number }>;
    levelBreakdown: Array<{ nivel: string; _count: number }>;
}

interface DiffStats {
    heatmap: Array<{ langCode: string; level: string; _count: number }>;
}

const QUALITY_COLORS: Record<string, string> = {
    gold: "bg-amber-500",
    reviewed: "bg-blue-500",
    edited: "bg-yellow-500",
    raw: "bg-gray-500",
    suspicious: "bg-orange-500",
    deprecated: "bg-red-500",
};

const NIVEL_COLORS: Record<string, string> = {
    a1: "bg-green-500",
    a2: "bg-emerald-500",
    b1: "bg-blue-500",
    b2: "bg-indigo-500",
    c1: "bg-purple-500",
};

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="flex items-center gap-2">
            <span className="w-24 truncate text-xs text-gray-400 capitalize">{label.replace(/_/g, " ")}</span>
            <div className="flex-1 h-3 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
            <span className="w-8 text-right text-xs font-bold">{value}</span>
        </div>
    );
}

export default function StatsPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch(`${BASE}/api/stats`).then((r) => r.json()),
            fetch(`${BASE}/api/stats/difficulty`).then((r) => r.json()),
        ]).then(([s, d]) => {
            setStats(s);
            setDiffStats(d);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="text-3xl"
                >
                    🌀
                </motion.div>
            </div>
        );
    }

    if (!stats) return null;

    const maxCat = Math.max(...stats.categoryBreakdown.map((c) => c._count), 1);

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">📊 Estatísticas</h2>
                <Link href="/" className="tap-scale text-xs text-gray-500">← Dashboard</Link>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-center">
                    <p className="text-2xl font-bold">{stats.totalCards}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Total</p>
                </div>
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-center">
                    <p className="text-2xl font-bold">{stats.reviewsToday}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Hoje</p>
                </div>
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-center">
                    <p className="text-2xl font-bold">{stats.dueNow}</p>
                    <p className="text-[10px] text-gray-500 uppercase">Pendentes</p>
                </div>
            </div>

            {/* Quality */}
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Qualidade</p>
                <div className="space-y-2">
                    {stats.qualityBreakdown.map((q) => (
                        <Bar
                            key={q.quality}
                            label={q.quality}
                            value={q._count}
                            total={stats.totalCards}
                            color={QUALITY_COLORS[q.quality] || "bg-gray-500"}
                        />
                    ))}
                </div>
            </div>

            {/* Level */}
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Nível</p>
                <div className="space-y-2">
                    {stats.levelBreakdown.map((l) => (
                        <Bar
                            key={l.nivel}
                            label={l.nivel.toUpperCase()}
                            value={l._count}
                            total={stats.totalCards}
                            color={NIVEL_COLORS[l.nivel] || "bg-gray-500"}
                        />
                    ))}
                </div>
            </div>

            {/* Category */}
            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Categorias</p>
                <div className="space-y-2">
                    {stats.categoryBreakdown
                        .sort((a, b) => b._count - a._count)
                        .map((c) => (
                            <Bar
                                key={c.categoria}
                                label={c.categoria}
                                value={c._count}
                                total={maxCat}
                                color="bg-blue-500"
                            />
                        ))}
                </div>
            </div>

            {/* Difficulty heatmap */}
            {diffStats?.heatmap && diffStats.heatmap.length > 0 && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Dificuldade por Idioma</p>
                    <div className="space-y-1">
                        {diffStats.heatmap.map((d) => (
                            <div key={`${d.langCode}-${d.level}`} className="flex items-center gap-2">
                                <span className="w-10 text-xs font-bold">{d.langCode}</span>
                                <span className="text-sm">
                                    {d.level === "easy" ? "🟢" : d.level === "medium" ? "🟡" : d.level === "hard" ? "🔴" : "⬛"}
                                </span>
                                <span className="text-xs text-gray-400">{d._count}×</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
