"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { langFlag, langName } from "@/lib/langFlags";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface MechanismRow {
    label: string;
    cells: string[];
}
interface Exercise {
    type: string;
    prompt: string;
    options: string[];
    correct: number;
    feedback: string;
}
interface GrammarContent {
    insight: string;
    mechanism: {
        type: string;
        rows: MechanismRow[];
        columns: string[];
        quick_rule: string;
        mnemonic?: string;
    };
    trap: {
        brain_does: string;
        correct: string;
        why_wrong: string;
        fix_rule: string;
    };
    anchor: string;
    exercises: Exercise[];
    related_cards: string[];
}
interface GrammarModuleData {
    id: string;
    language: string;
    cluster: string;
    title: string;
    subtitle: string | null;
    level: string;
    content: GrammarContent;
    prerequisites: string[];
    status: string;
    cardLinks?: Array<{
        card: { id: string; seq: number; frentePt: string };
    }>;
}

const CLUSTER_ICONS: Record<string, string> = {
    navigation: "🧭",
    opinion: "🗣️",
    time: "⏳",
    social: "🤝",
    structure: "🔧",
    precision: "🎯",
    morphology: "🔬",
    particle: "⚛️",
    connector: "🔗",
    honorific: "🎎",
    default: "📘",
};

function clusterIcon(cluster: string): string {
    return CLUSTER_ICONS[cluster.toLowerCase()] || CLUSTER_ICONS.default;
}

export default function GrammarModulePage() {
    const params = useParams();
    const router = useRouter();
    const moduleId = params.id as string;

    const [module, setModule] = useState<GrammarModuleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [openSection, setOpenSection] = useState<string | null>("insight");
    const [exerciseState, setExerciseState] = useState<Record<number, number | null>>({});
    const [showFeedback, setShowFeedback] = useState<Record<number, boolean>>({});

    useEffect(() => {
        fetchModule();
    }, [moduleId]); // eslint-disable-line react-hooks/exhaustive-deps

    async function fetchModule() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BASE}/api/grammar/${encodeURIComponent(moduleId)}`);
            if (res.ok) {
                const data = await res.json();
                setModule(data);
            } else if (res.status === 404) {
                setModule(null);
            } else {
                setError("Erro ao carregar módulo");
            }
        } catch {
            setError("Falha na conexão");
        }
        setLoading(false);
    }

    async function generateModule() {
        setGenerating(true);
        setError(null);
        // Parse module ID: DE_STRUCT_KASUS_DATIV → language=DE, cluster=struct, topic parts
        const parts = moduleId.split("_");
        const language = parts[0] || "DE";
        const cluster = parts[1]?.toLowerCase() || "structure";
        const topicName = parts.slice(2).join(" ");

        try {
            const res = await fetch(`${BASE}/api/grammar/${encodeURIComponent(moduleId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    language,
                    topic_id: moduleId,
                    topic_name: topicName || moduleId,
                    cluster,
                    level: "a2",
                }),
            });
            if (res.ok) {
                const data = await res.json();
                setModule(data);
            } else {
                const errData = await res.json().catch(() => ({}));
                setError(errData.error || `Erro ${res.status}`);
            }
        } catch {
            setError("Falha ao gerar módulo");
        }
        setGenerating(false);
    }

    function toggleSection(section: string) {
        setOpenSection(openSection === section ? null : section);
    }

    function handleExerciseAnswer(exerciseIdx: number, optionIdx: number) {
        setExerciseState((prev) => ({ ...prev, [exerciseIdx]: optionIdx }));
        setShowFeedback((prev) => ({ ...prev, [exerciseIdx]: true }));
    }

    // ─── Loading ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
        );
    }

    // ─── Not found → offer generation ────────────────────
    if (!module && !error) {
        return (
            <div className="space-y-6 py-8">
                <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300">
                    ← Voltar
                </button>
                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 text-center">
                    <p className="text-lg font-medium text-gray-200">
                        Módulo não encontrado
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        <span className="font-mono text-xs text-blue-400">{moduleId}</span>
                    </p>
                    <p className="mt-3 text-sm text-gray-400">
                        Este módulo ainda não foi gerado. Deseja criar agora com Opus?
                    </p>
                    <button
                        onClick={generateModule}
                        disabled={generating}
                        className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:opacity-50"
                    >
                        {generating ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Gerando com Opus...
                            </span>
                        ) : (
                            "🧠 Gerar módulo"
                        )}
                    </button>
                </div>
                {error && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                        {error}
                    </div>
                )}
            </div>
        );
    }

    if (error && !module) {
        return (
            <div className="space-y-4 py-8">
                <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300">
                    ← Voltar
                </button>
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-red-300">
                    {error}
                </div>
            </div>
        );
    }

    if (!module) return null;

    const content = module.content;
    const lang = module.language;

    // ─── Full module view ────────────────────────────────
    return (
        <div className="space-y-4 pb-8">
            {/* Header */}
            <div className="flex items-center gap-2 pt-2">
                <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-300">
                    ←
                </button>
                <span className="text-xs text-gray-500">
                    {langFlag(lang)} {langName(lang)} › {clusterIcon(module.cluster)} {module.cluster}
                </span>
            </div>

            <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-bold text-gray-100">{module.title}</h1>
                        {module.subtitle && (
                            <p className="mt-0.5 text-sm text-gray-400">{module.subtitle}</p>
                        )}
                    </div>
                    <span className="shrink-0 rounded-lg bg-blue-500/20 px-2 py-0.5 text-xs font-medium text-blue-300 uppercase">
                        {module.level}
                    </span>
                </div>
                {module.prerequisites.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        <span className="text-[10px] text-gray-500 uppercase">Pré-req:</span>
                        {module.prerequisites.map((p) => (
                            <Link
                                key={p}
                                href={`/grammar/${encodeURIComponent(p)}`}
                                className="rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-blue-300 transition-colors"
                            >
                                {p}
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Section 1: The Insight */}
            <SectionCard
                icon="🎯"
                title="O QUE É"
                sectionKey="insight"
                open={openSection === "insight"}
                onToggle={toggleSection}
            >
                <div className="space-y-3 text-[14px] leading-relaxed text-gray-300">
                    {content.insight.split("\n\n").map((para, i) => (
                        <p key={i}>{para}</p>
                    ))}
                </div>
            </SectionCard>

            {/* Section 2: The Mechanism */}
            <SectionCard
                icon="🔧"
                title="COMO FUNCIONA"
                sectionKey="mechanism"
                open={openSection === "mechanism"}
                onToggle={toggleSection}
            >
                <div className="space-y-3">
                    {content.mechanism?.rows?.length > 0 && (
                        <div className="overflow-x-auto rounded-lg bg-black/30">
                            <table className="w-full text-sm">
                                {content.mechanism.columns?.length > 0 && (
                                    <thead>
                                        <tr className="border-b border-gray-700/50">
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase" />
                                            {content.mechanism.columns.map((col, i) => (
                                                <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                )}
                                <tbody>
                                    {content.mechanism.rows.map((row, i) => (
                                        <tr key={i} className="border-b border-gray-800/50 last:border-none">
                                            <td className="px-3 py-2 font-medium text-gray-300">{row.label}</td>
                                            {row.cells.map((cell, j) => (
                                                <td key={j} className="px-3 py-2 text-gray-400">{cell}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {content.mechanism?.quick_rule && (
                        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2">
                            <span className="text-xs text-yellow-400 font-medium">⚡ Regra rápida: </span>
                            <span className="text-sm text-yellow-200">{content.mechanism.quick_rule}</span>
                        </div>
                    )}
                    {content.mechanism?.mnemonic && (
                        <p className="text-xs text-gray-500 italic">🔑 {content.mechanism.mnemonic}</p>
                    )}
                </div>
            </SectionCard>

            {/* Section 3: The Trap */}
            <SectionCard
                icon="🧠"
                title="A ARMADILHA"
                sectionKey="trap"
                open={openSection === "trap"}
                onToggle={toggleSection}
            >
                <div className="space-y-3">
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                        <p className="text-xs font-medium text-red-400 mb-1">❌ O que o cérebro brasileiro faz:</p>
                        <p className="text-sm text-red-200 font-mono">{content.trap?.brain_does}</p>
                    </div>
                    <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3">
                        <p className="text-xs font-medium text-green-400 mb-1">✅ O que deveria fazer:</p>
                        <p className="text-sm text-green-200 font-mono">{content.trap?.correct}</p>
                    </div>
                    {content.trap?.why_wrong && (
                        <p className="text-sm text-gray-400 leading-relaxed">{content.trap.why_wrong}</p>
                    )}
                    {content.trap?.fix_rule && (
                        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                            <span className="text-xs text-blue-400 font-medium">💡 Macete: </span>
                            <span className="text-sm text-blue-200">{content.trap.fix_rule}</span>
                        </div>
                    )}
                </div>
            </SectionCard>

            {/* Section 4: The Anchor */}
            <SectionCard
                icon="🔗"
                title="ÂNCORA PT-BR"
                sectionKey="anchor"
                open={openSection === "anchor"}
                onToggle={toggleSection}
            >
                <div className="space-y-3 text-[14px] leading-relaxed text-gray-300">
                    {content.anchor.split("\n\n").map((para, i) => (
                        <p key={i}>{para}</p>
                    ))}
                </div>
            </SectionCard>

            {/* Section 5: Practice */}
            <SectionCard
                icon="✏️"
                title={`PRATICAR (${content.exercises?.length || 0} exercícios)`}
                sectionKey="exercises"
                open={openSection === "exercises"}
                onToggle={toggleSection}
            >
                <div className="space-y-4">
                    {content.exercises?.map((ex, idx) => {
                        const answered = exerciseState[idx] !== undefined && exerciseState[idx] !== null;
                        const isCorrect = exerciseState[idx] === ex.correct;
                        return (
                            <div key={idx} className="rounded-lg bg-black/20 p-3 space-y-2">
                                <p className="text-xs text-gray-500 uppercase">
                                    {idx + 1}/{content.exercises.length} — {ex.type.replace("_", " ")}
                                </p>
                                <p className="text-sm text-gray-200 font-medium">{ex.prompt}</p>
                                <div className="flex flex-wrap gap-2">
                                    {ex.options.map((opt, optIdx) => {
                                        let btnClass = "rounded-lg border px-3 py-1.5 text-sm transition-all ";
                                        if (!answered) {
                                            btnClass += "border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-300 active:scale-95";
                                        } else if (optIdx === ex.correct) {
                                            btnClass += "border-green-500 bg-green-500/20 text-green-300";
                                        } else if (optIdx === exerciseState[idx]) {
                                            btnClass += "border-red-500 bg-red-500/20 text-red-300";
                                        } else {
                                            btnClass += "border-gray-800 text-gray-600";
                                        }
                                        return (
                                            <button
                                                key={optIdx}
                                                onClick={() => !answered && handleExerciseAnswer(idx, optIdx)}
                                                disabled={answered}
                                                className={btnClass}
                                            >
                                                {opt}
                                            </button>
                                        );
                                    })}
                                </div>
                                <AnimatePresence>
                                    {showFeedback[idx] && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            <div className={`mt-1 rounded-lg px-3 py-2 text-sm ${isCorrect ? "bg-green-500/10 text-green-300" : "bg-red-500/10 text-red-300"}`}>
                                                {isCorrect ? "✅ " : "❌ "}
                                                {ex.feedback}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </div>
            </SectionCard>

            {/* Section 6: Related Cards */}
            {module.cardLinks && module.cardLinks.length > 0 && (
                <SectionCard
                    icon="📎"
                    title="CARDS RELACIONADOS"
                    sectionKey="related"
                    open={openSection === "related"}
                    onToggle={toggleSection}
                >
                    <div className="space-y-1">
                        {module.cardLinks.map((link) => (
                            <Link
                                key={link.card.id}
                                href={`/study?card=${link.card.id}`}
                                className="flex items-center gap-2 rounded-lg p-2 hover:bg-white/5 transition-colors"
                            >
                                <span className="text-xs text-gray-600 font-mono">#{link.card.seq}</span>
                                <span className="text-sm text-gray-300 truncate">{link.card.frentePt}</span>
                            </Link>
                        ))}
                    </div>
                </SectionCard>
            )}
        </div>
    );
}

// ─── Collapsible Section Card Component ──────────────────

function SectionCard({
    icon,
    title,
    sectionKey,
    open,
    onToggle,
    children,
}: {
    icon: string;
    title: string;
    sectionKey: string;
    open: boolean;
    onToggle: (key: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
            <button
                onClick={() => onToggle(sectionKey)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-white/5"
            >
                <span className="text-base">{icon}</span>
                <span className="flex-1 text-sm font-semibold text-gray-200 uppercase tracking-wide">
                    {title}
                </span>
                <span className={`text-xs text-gray-600 transition-transform ${open ? "rotate-180" : ""}`}>
                    ▼
                </span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-[var(--card-border)] px-4 py-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
