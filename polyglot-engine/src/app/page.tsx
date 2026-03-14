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

const TIER_DATA = [
    { name: "S", langs: ["DE", "EN", "FR", "IT", "ES"], color: "from-yellow-500/20 to-yellow-600/5 border-yellow-500/20" },
    { name: "A", langs: ["JA", "KO", "ZH", "RU", "AR"], color: "from-purple-500/20 to-purple-600/5 border-purple-500/20" },
    { name: "B", langs: ["SV", "NO", "NL", "DA", "FI"], color: "from-blue-500/20 to-blue-600/5 border-blue-500/20" },
    { name: "C", langs: ["BCS", "HU", "CS", "PL", "TR"], color: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20" },
    { name: "D", langs: ["TH", "VI", "HE", "EL", "ID"], color: "from-gray-500/20 to-gray-600/5 border-gray-500/20" },
];

function StatCard({ label, value, icon, delay }: { label: string; value: string | number; icon: string; delay: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
                    <p className="mt-1 text-3xl font-bold">{value}</p>
                </div>
                <span className="text-3xl">{icon}</span>
            </div>
        </motion.div>
    );
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${BASE}/api/stats`)
            .then((r) => r.json())
            .then((data) => {
                setStats(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="space-y-6 pb-24">
            {/* Hero greeting */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
            >
                <h2 className="text-2xl font-bold">🌐 PolyGlot</h2>
                <p className="mt-1 text-sm text-gray-500">25 idiomas · 1 plataforma</p>
            </motion.div>

            {/* CTA — Study button */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
            >
                <Link
                    href="/study"
                    className="tap-scale flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 py-5 text-lg font-bold text-white active:from-blue-700 active:to-blue-800"
                >
                    <span className="text-2xl">📚</span>
                    Estudar {stats?.dueNow ? `(${stats.dueNow} pendentes)` : ""}
                </Link>
            </motion.div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
                <StatCard
                    label="Cards"
                    value={loading ? "—" : stats?.totalCards ?? 0}
                    icon="🃏"
                    delay={0.15}
                />
                <StatCard
                    label="Hoje"
                    value={loading ? "—" : stats?.reviewsToday ?? 0}
                    icon="✅"
                    delay={0.2}
                />
                <StatCard
                    label="Pendentes"
                    value={loading ? "—" : stats?.dueNow ?? 0}
                    icon="⏰"
                    delay={0.25}
                />
            </div>

            {/* Quality breakdown */}
            {stats?.qualityBreakdown && stats.qualityBreakdown.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
                >
                    <p className="mb-2 text-xs text-gray-500 uppercase tracking-wide">Qualidade</p>
                    <div className="flex flex-wrap gap-2">
                        {stats.qualityBreakdown.map((q) => (
                            <span
                                key={q.quality}
                                className="rounded-full bg-white/5 px-3 py-1 text-xs"
                            >
                                <span className="text-gray-400">{q.quality}:</span>{" "}
                                <span className="font-bold">{q._count}</span>
                            </span>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* Tier grid */}
            <div>
                <p className="mb-2 text-xs text-gray-500 uppercase tracking-wide px-1">Tiers</p>
                <div className="space-y-1.5">
                    {TIER_DATA.map((tier, i) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.35 + i * 0.05 }}
                        >
                            <Link
                                href={`/study?tier=${tier.name}`}
                                className={`tap-scale flex items-center gap-3 rounded-xl border bg-gradient-to-r px-3 py-3 ${tier.color}`}
                            >
                                <span className="w-10 text-center text-sm font-black">{tier.name}</span>
                                <div className="flex flex-1 flex-wrap gap-1">
                                    {tier.langs.map((l) => (
                                        <span key={l} className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-medium">
                                            {l}
                                        </span>
                                    ))}
                                </div>
                                <span className="text-xs text-gray-500">→</span>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Quick links */}
            <div className="grid grid-cols-2 gap-2">
                <Link
                    href="/browse"
                    className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
                >
                    <span className="text-2xl">🔍</span>
                    <span className="text-xs font-medium text-gray-400">Explorar</span>
                </Link>
                <Link
                    href="/stats"
                    className="tap-scale flex flex-col items-center gap-1 rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
                >
                    <span className="text-2xl">📊</span>
                    <span className="text-xs font-medium text-gray-400">Estatísticas</span>
                </Link>
            </div>
        </div>
    );
}
