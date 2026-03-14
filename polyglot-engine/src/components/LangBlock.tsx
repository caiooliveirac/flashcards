"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TtsButton from "./TtsButton";
import type { LangCode } from "@/lib/types";

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

export default function LangBlock({
    bloco,
    defaultExpanded = false,
}: {
    bloco: LangBlocoData;
    defaultExpanded?: boolean;
}) {
    const [expanded, setExpanded] = useState(defaultExpanded);
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
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold ${tierClass}`}>
                    {bloco.langCode}
                </span>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{bloco.natural}</p>
                    {hasRoman && (
                        <p className="truncate text-xs text-gray-500">{bloco.romanizacao}</p>
                    )}
                </div>
                <TtsButton text={bloco.natural} langCode={bloco.langCode as LangCode} size="sm" />
                <span className={`text-xs text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}>
                    ▼
                </span>
            </button>

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
                            <Detail label="Gramática" value={bloco.gramatica} />
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
