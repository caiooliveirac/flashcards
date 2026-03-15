"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { langFlag, langName, LANG_FLAG } from "@/lib/langFlags";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface LangStats {
    language: string;
    count: number;
}

export default function GrammarPage() {
    const [stats, setStats] = useState<LangStats[]>([]);
    const [totalModules, setTotalModules] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    async function fetchStats() {
        try {
            const res = await fetch(`${BASE}/api/grammar`);
            if (res.ok) {
                const data = await res.json();
                setTotalModules(data.total);
                // Count per language
                const langCounts: Record<string, number> = {};
                for (const m of data.modules) {
                    langCounts[m.language] = (langCounts[m.language] || 0) + 1;
                }
                const sorted = Object.entries(langCounts)
                    .map(([language, count]) => ({ language, count }))
                    .sort((a, b) => b.count - a.count);
                setStats(sorted);
            }
        } catch {
            /* ignore */
        }
        setLoading(false);
    }

    return (
        <div className="space-y-5 pb-8">
            {/* Header */}
            <div className="pt-2">
                <h1 className="text-2xl font-bold text-gray-100">📖 Gramática</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Módulos profundos de gramática gerados por IA — click to learn
                </p>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-center">
                    <p className="text-3xl font-bold text-blue-400">{totalModules}</p>
                    <p className="text-xs text-gray-500 mt-1">Módulos gerados</p>
                </div>
                <Link
                    href="/grammar/map"
                    className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4 text-center hover:border-blue-500/30 transition-colors"
                >
                    <p className="text-3xl">🗺️</p>
                    <p className="text-xs text-gray-500 mt-1">Grammar Map</p>
                </Link>
            </div>

            {/* Language grid */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
            ) : (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
                        Idiomas
                    </h2>

                    {stats.length > 0 ? (
                        <div className="space-y-1.5">
                            {stats.map((s) => (
                                <Link
                                    key={s.language}
                                    href={`/grammar/map?lang=${s.language}`}
                                    className="flex items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3 hover:border-blue-500/30 transition-all active:scale-[0.99]"
                                >
                                    <span className="text-2xl">{langFlag(s.language)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-200">{langName(s.language)}</p>
                                        <p className="text-xs text-gray-500">{s.count} módulos</p>
                                    </div>
                                    <span className="text-xs text-gray-600">→</span>
                                </Link>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-dashed border-gray-700 p-6 text-center">
                            <p className="text-3xl mb-2">🧠</p>
                            <p className="text-sm text-gray-400">
                                Nenhum módulo gerado ainda.
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                                Acesse um tópico de gramática nos flashcards para gerar o primeiro módulo.
                            </p>
                        </div>
                    )}

                    {/* Browse all languages */}
                    <details className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)]">
                        <summary className="cursor-pointer px-4 py-3 text-sm text-gray-400 hover:text-gray-200">
                            Todos os {Object.keys(LANG_FLAG).length} idiomas
                        </summary>
                        <div className="grid grid-cols-2 gap-1.5 px-4 pb-3">
                            {Object.keys(LANG_FLAG).map((code) => (
                                <Link
                                    key={code}
                                    href={`/grammar/map?lang=${code}`}
                                    className="flex items-center gap-2 rounded-lg p-2 text-sm text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                >
                                    <span>{langFlag(code)}</span>
                                    <span className="truncate">{langName(code)}</span>
                                </Link>
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}
