"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LangBlock from "./LangBlock";
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

export default function StudyCard({
    card,
    onReveal,
    onDifficulty,
    focusLang,
}: {
    card: CardData;
    onReveal: () => void;
    onDifficulty?: (langCode: string, level: string, types: string[]) => void;
    focusLang?: string | null;
}) {
    const [revealed, setRevealed] = useState(false);
    const [diffLang, setDiffLang] = useState<string | null>(null);

    const handleReveal = () => {
        setRevealed(true);
        onReveal();
    };

    // Sort blocos: focused lang first, then principal, then tier order
    const sortedBlocos = [...card.blocos].sort((a, b) => {
        if (focusLang) {
            if (a.langCode === focusLang) return -1;
            if (b.langCode === focusLang) return 1;
        }
        const aPrincipal = card.idiomasPrincipais.includes(a.langCode);
        const bPrincipal = card.idiomasPrincipais.includes(b.langCode);
        if (aPrincipal && !bPrincipal) return -1;
        if (!aPrincipal && bPrincipal) return 1;
        return 0;
    });

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
                        className="mt-3 space-y-2"
                    >
                        {/* Global note */}
                        <p className="rounded-xl bg-white/5 px-3 py-2 text-sm italic text-gray-400 leading-snug">
                            💡 {card.notaGlobal}
                        </p>

                        {/* Lang blocks */}
                        {sortedBlocos.map((bloco, i) => {
                            const diff = getDiff(bloco.langCode);
                            const isPrincipal = card.idiomasPrincipais.includes(bloco.langCode);
                            const isFocused = focusLang === bloco.langCode;

                            return (
                                <div key={bloco.langCode}>
                                    {isPrincipal && i === 0 && (
                                        <p className="mb-1 text-[10px] uppercase tracking-widest text-yellow-500/60 pl-1">
                                            ★ Idiomas principais
                                        </p>
                                    )}
                                    <LangBlock
                                        bloco={bloco}
                                        defaultExpanded={isFocused || isPrincipal}
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
