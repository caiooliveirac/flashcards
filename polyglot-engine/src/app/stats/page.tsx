"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { langFlag } from "@/lib/langFlags";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface Stats {
    totalCards: number;
    dueNow: number;
    reviewsToday: number;
    qualityBreakdown: Array<{ quality: string; _count: number }>;
    categoryBreakdown: Array<{ categoria: string; _count: number }>;
    levelBreakdown: Array<{ nivel: string; _count: number }>;
    byTier?: Record<string, { total: number; due: number; reviewed_today: number }>;
    generation?: { today: number; week: number; month: number; costMonth: number };
    difficultyHeatmap?: Array<{ langCode: string; type: string; count: number }>;
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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/stats`).then((r) => r.json())
            .then((s) => { setStats(s); setLoading(false); })
            .catch(() => setLoading(false));
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

            {/* Generation stats */}
            {stats.generation && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Geração</p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold">{stats.generation.today}</p>
                            <p className="text-[10px] text-gray-500">Hoje</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold">{stats.generation.week}</p>
                            <p className="text-[10px] text-gray-500">Semana</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold">{stats.generation.month}</p>
                            <p className="text-[10px] text-gray-500">Mês</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3 text-center">
                            <p className="text-lg font-bold text-yellow-400">${stats.generation.costMonth.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-500">Custo mês</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tiers */}
            {stats.byTier && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Blocos por Tier</p>
                    <div className="space-y-2">
                        {Object.entries(stats.byTier).map(([tier, data]) => (
                            <div key={tier} className="flex items-center justify-between text-xs">
                                <span className="font-medium w-16">{tier}</span>
                                <div className="flex gap-3 text-gray-400">
                                    <span>{data.total} blocos</span>
                                    <span className="text-blue-400">{data.due} due</span>
                                    <span className="text-green-400">{data.reviewed_today} hoje</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Difficulty heatmap */}
            {stats.difficultyHeatmap && stats.difficultyHeatmap.length > 0 && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                    <p className="mb-3 text-xs text-gray-500 uppercase tracking-wide">Dificuldade por Idioma</p>
                    <div className="space-y-1">
                        {stats.difficultyHeatmap.map((d) => (
                            <div key={`${d.langCode}-${d.type}`} className="flex items-center gap-2">
                                <span className="w-7 text-lg leading-none">{d.langCode}</span>
                                <span className="text-sm">
                                    {d.type === "easy" ? "🟢" : d.type === "medium" ? "🟡" : d.type === "hard" ? "🔴" : "⬛"}
                                </span>
                                <span className="text-xs text-gray-400">{d.count}×</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
