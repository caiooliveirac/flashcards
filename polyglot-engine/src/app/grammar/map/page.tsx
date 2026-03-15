"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { langFlag, langName, LANG_FLAG } from "@/lib/langFlags";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const CLUSTER_META: Record<string, { icon: string; label: string; color: string }> = {
    navigation: { icon: "🧭", label: "Navegação", color: "border-emerald-500/40 bg-emerald-500/10" },
    opinion: { icon: "🗣️", label: "Opinião", color: "border-purple-500/40 bg-purple-500/10" },
    time: { icon: "⏳", label: "Tempo", color: "border-amber-500/40 bg-amber-500/10" },
    social: { icon: "🤝", label: "Social", color: "border-pink-500/40 bg-pink-500/10" },
    structure: { icon: "🔧", label: "Estrutura", color: "border-blue-500/40 bg-blue-500/10" },
    precision: { icon: "🎯", label: "Precisão", color: "border-red-500/40 bg-red-500/10" },
    morphology: { icon: "🔬", label: "Morfologia", color: "border-cyan-500/40 bg-cyan-500/10" },
    particle: { icon: "⚛️", label: "Partículas", color: "border-violet-500/40 bg-violet-500/10" },
    connector: { icon: "🔗", label: "Conectores", color: "border-orange-500/40 bg-orange-500/10" },
    honorific: { icon: "🎎", label: "Honoríficos", color: "border-rose-500/40 bg-rose-500/10" },
};

const LEVEL_COLORS: Record<string, string> = {
    a1: "bg-green-500/20 text-green-300",
    a2: "bg-blue-500/20 text-blue-300",
    b1: "bg-yellow-500/20 text-yellow-300",
    b2: "bg-orange-500/20 text-orange-300",
    c1: "bg-red-500/20 text-red-300",
};

interface ModuleSummary {
    id: string;
    language: string;
    cluster: string;
    title: string;
    subtitle: string | null;
    level: string;
    prerequisites: string[];
    status: string;
    qualityScore: number | null;
}

// Top languages to show first
const PRIORITY_LANGS = ["DE", "EN", "FR", "IT", "ES", "JA", "KO", "ZH", "RU", "AR", "TR"];

export default function GrammarMapPage() {
    return (
        <Suspense>
            <GrammarMapInner />
        </Suspense>
    );
}

function GrammarMapInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialLang = searchParams.get("lang")?.toUpperCase() || "";

    const [selectedLang, setSelectedLang] = useState(initialLang);
    const [modules, setModules] = useState<ModuleSummary[]>([]);
    const [clusters, setClusters] = useState<Record<string, ModuleSummary[]>>({});
    const [loading, setLoading] = useState(false);

    // Available languages from the database
    const allLangs = Object.keys(LANG_FLAG);

    useEffect(() => {
        if (selectedLang) fetchMap(selectedLang);
    }, [selectedLang]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchMap(lang: string) {
        setLoading(true);
        try {
            const res = await fetch(`${BASE}/api/grammar/map?lang=${lang}`);
            if (res.ok) {
                const data = await res.json();
                setModules(data.modules || []);
                setClusters(data.clusters || {});
            }
        } catch {
            /* ignore */
        }
        setLoading(false);
    }

    return (
        <div className="space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-center justify-between pt-2">
                <h1 className="text-xl font-bold text-gray-100">🗺️ Grammar Map</h1>
                <span className="text-xs text-gray-500">{modules.length} módulos</span>
            </div>

            {/* Language selector */}
            <div className="flex flex-wrap gap-1.5">
                {PRIORITY_LANGS.map((code) => (
                    <button
                        key={code}
                        onClick={() => setSelectedLang(code)}
                        className={`rounded-lg px-2.5 py-1.5 text-sm transition-all active:scale-95 ${selectedLang === code
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                : "bg-[var(--card-bg)] border border-[var(--card-border)] text-gray-400 hover:text-gray-200"
                            }`}
                    >
                        {langFlag(code)} {code}
                    </button>
                ))}
                <details className="relative">
                    <summary className="cursor-pointer rounded-lg bg-[var(--card-bg)] border border-[var(--card-border)] px-2.5 py-1.5 text-sm text-gray-500 hover:text-gray-300">
                        mais...
                    </summary>
                    <div className="absolute right-0 z-50 mt-1 grid grid-cols-3 gap-1 rounded-lg bg-gray-900 border border-gray-700 p-2 shadow-xl">
                        {allLangs
                            .filter((c) => !PRIORITY_LANGS.includes(c))
                            .map((code) => (
                                <button
                                    key={code}
                                    onClick={() => { setSelectedLang(code); }}
                                    className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                                >
                                    {langFlag(code)} {code}
                                </button>
                            ))}
                    </div>
                </details>
            </div>

            {/* No language selected */}
            {!selectedLang && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-8 text-center">
                    <p className="text-4xl mb-3">🗺️</p>
                    <p className="text-gray-400">Selecione um idioma para ver o mapa de gramática</p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex justify-center py-12">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                </div>
            )}

            {/* Empty state */}
            {selectedLang && !loading && modules.length === 0 && (
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center space-y-3">
                    <p className="text-3xl">{langFlag(selectedLang)}</p>
                    <p className="text-gray-300 font-medium">
                        Nenhum módulo de gramática para {langName(selectedLang)}
                    </p>
                    <p className="text-sm text-gray-500">
                        Módulos são gerados on-demand quando você acessa um tópico de gramática nos flashcards.
                    </p>
                </div>
            )}

            {/* Cluster groups */}
            {!loading && Object.entries(clusters).map(([cluster, mods]) => {
                const meta = CLUSTER_META[cluster.toLowerCase()] || {
                    icon: "📘",
                    label: cluster,
                    color: "border-gray-500/40 bg-gray-500/10",
                };
                return (
                    <div key={cluster} className="space-y-2">
                        <div className="flex items-center gap-2 px-1">
                            <span className="text-base">{meta.icon}</span>
                            <span className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                                {meta.label}
                            </span>
                            <span className="text-xs text-gray-600">({mods.length})</span>
                        </div>
                        <div className="space-y-1.5">
                            {mods.map((mod) => (
                                <Link
                                    key={mod.id}
                                    href={`/grammar/${encodeURIComponent(mod.id)}`}
                                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all hover:scale-[1.01] active:scale-[0.99] ${meta.color}`}
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-200 truncate">
                                            {mod.title}
                                        </p>
                                        {mod.subtitle && (
                                            <p className="text-xs text-gray-500 truncate">{mod.subtitle}</p>
                                        )}
                                    </div>
                                    <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase ${LEVEL_COLORS[mod.level] || ""}`}>
                                        {mod.level}
                                    </span>
                                    {mod.prerequisites.length > 0 && (
                                        <span className="shrink-0 text-[10px] text-gray-600" title={`Pré-req: ${mod.prerequisites.join(", ")}`}>
                                            🔒 {mod.prerequisites.length}
                                        </span>
                                    )}
                                    <StatusDot status={mod.status} />
                                </Link>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function StatusDot({ status }: { status: string }) {
    const colors: Record<string, string> = {
        draft: "bg-gray-500",
        generated: "bg-blue-500",
        reviewed: "bg-green-500",
        gold: "bg-yellow-500",
    };
    return (
        <span
            className={`h-2 w-2 shrink-0 rounded-full ${colors[status] || "bg-gray-700"}`}
            title={status}
        />
    );
}
