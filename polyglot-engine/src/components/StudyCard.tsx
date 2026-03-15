"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LangBlock from "./LangBlock";
import LangRailNav from "./LangRailNav";
import DifficultyMarker from "./DifficultyMarker";
import type { LangCode } from "@/lib/types";

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
    blocos: Array<{
        id: string;
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
    }>;
    difficulties?: Array<{
        langCode: string;
        level: string;
        types: string[];
    }>;
}

const TIER_LANGS: Record<string, string[]> = {
    S: ["DE", "EN", "FR", "IT", "ES"],
    A: ["JA", "KO", "ZH", "RU", "AR"],
    B: ["SV", "NO", "NL", "DA", "FI"],
    C: ["BCS", "HU", "CS", "PL", "TR"],
    D: ["TH", "VI", "HE", "EL", "ID"],
};

export default function StudyCard({
    card,
    onReveal,
    onDifficulty,
    focusLang,
    focusTier,
}: {
    card: CardData;
    onReveal: () => void;
    onDifficulty?: (langCode: string, level: string, types: string[]) => void;
    focusLang?: string | null;
    focusTier?: string | null;
}) {
    const [revealed, setRevealed] = useState(false);
    const [diffLang, setDiffLang] = useState<string | null>(null);

    const handleReveal = () => {
        setRevealed(true);
        onReveal();
    };

    // Determine lens: which langs to show
    const lensLangs: string[] | null = focusLang
        ? [focusLang]
        : focusTier && TIER_LANGS[focusTier.toUpperCase()]
            ? TIER_LANGS[focusTier.toUpperCase()]
            : null;

    // Filter blocos to lens, then sort by tier order
    const TIER_ORDER = ["DE", "EN", "FR", "IT", "ES", "JA", "KO", "ZH", "RU", "AR", "SV", "NO", "NL", "DA", "FI", "BCS", "HU", "CS", "PL", "TR", "TH", "VI", "HE", "EL", "ID"];
    const tierMap = Object.fromEntries(TIER_ORDER.map((l, i) => [l, i]));

    const filteredBlocos = lensLangs
        ? card.blocos.filter((b) => lensLangs.includes(b.langCode))
        : card.blocos;

    const sortedBlocos = [...filteredBlocos].sort((a, b) => {
        if (focusLang) {
            if (a.langCode === focusLang) return -1;
            if (b.langCode === focusLang) return 1;
        }
        const ia = tierMap[a.langCode] ?? 999;
        const ib = tierMap[b.langCode] ?? 999;
        return ia - ib;
    });

    const sortedLangs = sortedBlocos.map((b) => b.langCode);

    const getDiff = (langCode: string) =>
        card.difficulties?.find((d) => d.langCode === langCode);

    return (
        <div className="flex flex-col">
            {/* Front — context + phrase */}
            <motion.div
                layout
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
            >
                <div className="mb-1 flex items-center gap-2 text-xs text-gray-500">
                    <span>#{card.seq}</span>
                    <span>·</span>
                    <span className="uppercase">{card.nivel}</span>
                    <span>·</span>
                    <span className="capitalize">{card.categoria.replace(/_/g, " ")}</span>
                </div>

                <p className="mb-2 text-sm text-gray-400 leading-snug">{card.contexto}</p>

                <p className="text-lg font-semibold leading-tight">{card.frentePt}</p>

                {card.objetivo && (
                    <p className="mt-2 text-xs text-blue-400/70">🎯 {card.objetivo}</p>
                )}
            </motion.div>

            {/* Reveal button */}
            {!revealed && (
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleReveal}
                    className="tap-scale mt-3 rounded-2xl bg-blue-600 py-4 text-center text-lg font-bold text-white active:bg-blue-700"
                >
                    Revelar ✨
                </motion.button>
            )}

            {/* Back — blocos */}
            <AnimatePresence>
                {revealed && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                        className="mt-3 space-y-2 pr-10"
                    >
                        <LangRailNav langs={sortedLangs} />
                        {/* Global note */}
                        <div className="group relative rounded-xl bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/30 hover:border-blue-400/50 px-4 py-3 transition-all duration-200">
                            <p className="text-sm font-medium leading-relaxed text-blue-50 opacity-95">
                                <span className="mr-2">💡</span>
                                {card.notaGlobal}
                            </p>
                            <div className="absolute inset-0 rounded-xl bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
                        </div>

                        {/* Lang blocks */}
                        {sortedBlocos.map((bloco) => {
                            const diff = getDiff(bloco.langCode);
                            const isFocused = focusLang === bloco.langCode;

                            return (
                                <div key={bloco.langCode} id={`lang-${bloco.langCode}`}>
                                    <LangBlock
                                        bloco={bloco}
                                        defaultExpanded={isFocused}
                                    />

                                    {/* Difficulty marker toggle */}
                                    {onDifficulty && (
                                        <div className="mt-1 flex items-center gap-2 px-1">
                                            <button
                                                onClick={() => setDiffLang(diffLang === bloco.langCode ? null : bloco.langCode)}
                                                className="tap-scale text-xs text-gray-500 hover:text-gray-300"
                                            >
                                                {diff
                                                    ? `${diff.level === "easy" ? "🟢" : diff.level === "medium" ? "🟡" : diff.level === "hard" ? "🔴" : "⬛"} dificuldade`
                                                    : "📊 marcar dificuldade"
                                                }
                                            </button>
                                        </div>
                                    )}

                                    <AnimatePresence>
                                        {diffLang === bloco.langCode && onDifficulty && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden px-1 py-1"
                                            >
                                                <DifficultyMarker
                                                    currentLevel={diff?.level}
                                                    currentTypes={diff?.types}
                                                    onMark={(level, types) => {
                                                        onDifficulty(bloco.langCode, level, types);
                                                        setDiffLang(null);
                                                    }}
                                                />
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
