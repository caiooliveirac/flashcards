"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TtsButton from "./TtsButton";
import type { LangCode } from "@/lib/types";
import { langFlag, langName } from "@/lib/langFlags";

interface LangBlocoData {
    langCode: string;
    natural: string;
    romanizacao?: string | null;
    variacaoNativa?: string | null;
    literal?: string | null;
    padrao?: string | null;
    gramatica?: string | null;
    obs?: string | null;
    erroTipico?: string | null;
    contraste?: string | null;
    armadilha?: string | null;
    padraoReutilizavel?: string | null;
    gatilho?: string | null;
    registro?: string | null;
    sinonimos?: string | null;
    antonimo?: string | null;
    collocations?: string | null;
    campoSemantico?: string | null;
    registroVariacoes?: string | null;
    insight?: string | null;
}

const TIER_COLORS: Record<string, string> = {
    S: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    A: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    B: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    C: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    D: "bg-gray-500/20 text-gray-300 border-gray-500/30",
};

function getTierLetter(langCode: string): string {
    const tiers: Record<string, string[]> = {
        S: ["DE", "EN", "FR", "IT", "ES"],
        A: ["JA", "KO", "ZH", "RU", "AR"],
        B: ["SV", "NO", "NL", "DA", "FI"],
        C: ["BCS", "HU", "CS", "PL", "TR"],
        D: ["TH", "VI", "HE", "EL", "ID"],
    };
    for (const [t, langs] of Object.entries(tiers)) {
        if (langs.includes(langCode)) return t;
    }
    return "D";
}

function Detail({ label, value }: { label: string; value?: string | null }) {
    if (!value || value === "—") return null;
    return (
        <div className="py-1">
            <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
            <p className="text-sm leading-snug text-gray-300">{value}</p>
        </div>
    );
}

/**
 * Build a grammar module ID from langCode + grammar description text.
 * Normalizes to format: {LANG}_{CLUSTER}_{TOPIC}
 * e.g. "Wechselpräpositionen: Akkusativ vs Dativ" → "DE_GRAM_WECHSELPRAPOSITIONEN"
 */
function buildGrammarModuleId(langCode: string, grammarText: string): string {
    const lang = langCode.toUpperCase();
    // Take first meaningful segment before colon/dash/parenthesis
    const mainTopic = grammarText.split(/[:\-—(]/)[0].trim();
    // Normalize: remove diacritics, lowercase, replace spaces with underscore
    const slug = mainTopic
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase()
        .slice(0, 40);
    return `${lang}_GRAM_${slug || "TOPIC"}`;
}

export default function LangBlock({
    bloco,
    defaultExpanded = false,
}: {
    bloco: LangBlocoData;
    defaultExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [showInsight, setShowInsight] = useState(false);
    const router = useRouter();
    const tierLetter = getTierLetter(bloco.langCode);
    const tierClass = TIER_COLORS[tierLetter] || TIER_COLORS.D;

    const hasRoman = bloco.romanizacao && bloco.romanizacao !== "—";

    return (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] overflow-hidden">
            {/* Header — always visible, tappable */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="tap-scale flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
            >
                <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 text-base leading-none ${tierClass}`}
                    title={langName(bloco.langCode)}
                >
                    {langFlag(bloco.langCode)}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{bloco.natural}</p>
                    {hasRoman && (
                        <p className="truncate text-xs text-gray-500">{bloco.romanizacao}</p>
                    )}
                </div>
                <TtsButton text={bloco.natural} langCode={bloco.langCode as LangCode} size="sm" />
                {bloco.insight && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowInsight(!showInsight);
                        }}
                        className={`shrink-0 text-base transition-all ${showInsight ? "scale-110 drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]" : "opacity-60 hover:opacity-100"}`}
                        title="Insight cross-linguístico"
                    >
                        💡
                    </button>
                )}
                <span className={`text-xs text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
                    ▼
                </span>
            </button>

            {/* Insight tooltip */}
            <AnimatePresence>
                {showInsight && bloco.insight && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="border-t border-yellow-500/20 bg-yellow-500/5 px-3 py-2">
                            <p className="text-[13px] leading-relaxed text-yellow-200/90">
                                💡 {bloco.insight}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Expanded details */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-0.5 border-t border-[var(--card-border)] px-3 py-2">
                            {bloco.variacaoNativa && bloco.variacaoNativa !== "—" && (
                                <p className="text-sm italic text-amber-400/80">
                                    🗣️ {bloco.variacaoNativa}
                                </p>
                            )}
                            <Detail label="Literal" value={bloco.literal} />
                            <Detail label="Padrão" value={bloco.padrao} />
                            {bloco.gramatica && bloco.gramatica !== "—" && (
                                <div className="py-1">
                                    <span className="text-[11px] uppercase tracking-wide text-gray-500">Gramática</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const moduleId = buildGrammarModuleId(bloco.langCode, bloco.gramatica!);
                                            router.push(`/grammar/${encodeURIComponent(moduleId)}`);
                                        }}
                                        className="group mt-0.5 flex w-full items-center gap-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1.5 text-left transition-all hover:bg-indigo-500/20 hover:border-indigo-500/40 active:scale-[0.98]"
                                    >
                                        <span className="text-sm leading-snug text-indigo-300 group-hover:text-indigo-200 flex-1">
                                            📖 {bloco.gramatica}
                                        </span>
                                        <span className="shrink-0 text-xs text-indigo-500 group-hover:text-indigo-400">→</span>
                                    </button>
                                </div>
                            )}
                            <Detail label="Obs" value={bloco.obs} />
                            <Detail label="⚠️ Erro típico" value={bloco.erroTipico} />
                            <Detail label="🔀 Contraste" value={bloco.contraste} />
                            <Detail label="💣 Armadilha" value={bloco.armadilha} />
                            <Detail label="🔁 Padrão reutilizável" value={bloco.padraoReutilizavel} />
                            <Detail label="🎯 Gatilho" value={bloco.gatilho} />
                            <Detail label="📝 Registro" value={bloco.registro} />

                            {/* Thesaurus section */}
                            {(bloco.sinonimos || bloco.antonimo || bloco.collocations) && (
                                <div className="mt-2 rounded-lg bg-white/5 p-2">
                                    <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">
                                        Thesaurus
                                    </p>
                                    <Detail label="Sinônimos" value={bloco.sinonimos} />
                                    <Detail label="Antônimo" value={bloco.antonimo} />
                                    <Detail label="Collocations" value={bloco.collocations} />
                                    <Detail label="Campo semântico" value={bloco.campoSemantico} />
                                    <Detail label="Variações registro" value={bloco.registroVariacoes} />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
