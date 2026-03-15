"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import Link from "next/link";
import LangBlock from "@/components/LangBlock";
import QualityBadge from "@/components/QualityBadge";
import DifficultyMarker from "@/components/DifficultyMarker";
import LangRailNav from "@/components/LangRailNav";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface FullCard {
    id: string;
    seq: number;
    tipo: string;
    contexto: string;
    frentePt: string;
    notaGlobal: string;
    objetivo: string;
    nivel: string;
    categoria: string;
    quality: string;
    source: string;
    idiomasPrincipais: string[];
    familiaContraste: string | null;
    createdAt: string;
    blocos: Array<Record<string, unknown>>;
    difficulties: Array<{ langCode: string; level: string; types: string[] }>;
    tags: Array<{ tag: { id: string; name: string } }>;
}

export default function CardDetailPage() {
    const params = useParams();
    const id = params.id as string;
    const [card, setCard] = useState<FullCard | null>(null);
    const [loading, setLoading] = useState(true);
    const [diffLang, setDiffLang] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${BASE}/api/cards/${id}`)
            .then((r) => r.json())
            .then((data) => {
                setCard(data.card || data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [id]);

    const handleDifficulty = async (langCode: string, level: string, types: string[]) => {
        if (!card) return;
        await fetch(`${BASE}/api/cards/${card.id}/difficulty`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ langCode, level, types }),
        });
        setCard((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                difficulties: [
                    ...prev.difficulties.filter((d) => d.langCode !== langCode),
                    { langCode, level, types },
                ],
            };
        });
        setDiffLang(null);
    };

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

    if (!card) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
                <span className="text-4xl">😿</span>
                <p className="text-gray-500">Card não encontrado</p>
                <Link href="/browse" className="text-sm text-blue-400">
                    ← Voltar
                </Link>
            </div>
        );
    }

    const getDiff = (langCode: string) =>
        card.difficulties?.find((d) => d.langCode === langCode);

    const TIER_ORDER = ["DE", "EN", "FR", "IT", "ES", "JA", "KO", "ZH", "RU", "AR", "SV", "NO", "NL", "DA", "FI", "BCS", "HU", "CS", "PL", "TR", "TH", "VI", "HE", "EL", "ID"];
    const cardLangs = (card.blocos as Array<Record<string, unknown>>)
        .map((b) => b.langCode as string)
        .sort((a, b) => {
            const ia = TIER_ORDER.indexOf(a);
            const ib = TIER_ORDER.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

    return (
        <div className="space-y-4 pb-24">
            <LangRailNav langs={cardLangs} />
            {/* Back button */}
            <Link
                href="/browse"
                className="tap-scale inline-flex items-center gap-1 text-sm text-gray-500 active:text-gray-300"
            >
                ← Explorar
            </Link>

            {/* Card header */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4"
            >
                <div className="mb-2 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-600">#{card.seq}</span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase font-medium">
                        {card.nivel}
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] capitalize font-medium">
                        {card.categoria.replace(/_/g, " ")}
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
                        {card.tipo}
                    </span>
                    <QualityBadge quality={card.quality} />
                </div>

                <p className="text-sm text-gray-400 leading-snug mb-2">{card.contexto}</p>
                <p className="text-lg font-semibold">{card.frentePt}</p>

                {card.objetivo && (
                    <p className="mt-2 text-xs text-blue-400/70">🎯 {card.objetivo}</p>
                )}

                <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm italic text-gray-400 leading-snug">
                    💡 {card.notaGlobal}
                </p>

                {/* Tags */}
                {card.tags?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {card.tags.map((t) => (
                            <span
                                key={t.tag.id}
                                className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] text-blue-300"
                            >
                                #{t.tag.name}
                            </span>
                        ))}
                    </div>
                )}

                {/* Meta */}
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-gray-600">
                    <span>📥 {card.source}</span>
                    {card.familiaContraste && <span>🔀 {card.familiaContraste}</span>}
                    <span>📅 {new Date(card.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
            </motion.div>

            {/* Principal langs indicator */}
            {card.idiomasPrincipais?.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] uppercase tracking-widest text-yellow-500/60">★ Principais:</span>
                    {card.idiomasPrincipais.map((l) => (
                        <span key={l} className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[11px] font-bold text-yellow-300">
                            {l}
                        </span>
                    ))}
                </div>
            )}

            {/* Lang blocks */}
            <div className="space-y-2 pr-10">
                {(() => {
                    const tierOrder = [
                        "DE", "EN", "FR", "IT", "ES", // Tier S
                        "JA", "KO", "ZH", "RU", "AR", // Tier A
                        "SV", "NO", "NL", "DA", "FI", // Tier B
                        "BCS", "HU", "CS", "PL", "TR", // Tier C
                        "TH", "VI", "HE", "EL", "ID", // Tier D
                    ];
                    const orderMap = Object.fromEntries(tierOrder.map((lang, idx) => [lang, idx]));

                    return (card.blocos as Array<Record<string, unknown>>)
                        .slice()
                        .sort((a, b) => {
                            const la = (a.langCode as string) ?? "";
                            const lb = (b.langCode as string) ?? "";
                            const ia = orderMap[la] ?? 999;
                            const ib = orderMap[lb] ?? 999;
                            if (ia !== ib) return ia - ib;
                            return la.localeCompare(lb);
                        })
                        .map((bloco) => {
                            const langCode = bloco.langCode as string;
                            const diff = getDiff(langCode);
                            return (
                                <div key={langCode} id={`lang-${langCode}`}>
                                    <LangBlock
                                        bloco={bloco as unknown as Parameters<typeof LangBlock>[0]["bloco"]}
                                        defaultExpanded={false}
                                    />
                                    <div className="mt-1 flex items-center gap-2 px-1">
                                        <button
                                            onClick={() => setDiffLang(diffLang === langCode ? null : langCode)}
                                            className="tap-scale text-xs text-gray-500 hover:text-gray-300"
                                        >
                                            {diff
                                                ? `${diff.level === "easy" ? "🟢" : diff.level === "medium" ? "🟡" : diff.level === "hard" ? "🔴" : "⬛"} dificuldade`
                                                : "📊 marcar dificuldade"
                                            }
                                        </button>
                                    </div>
                                    {diffLang === langCode && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            className="overflow-hidden px-1 py-1"
                                        >
                                            <DifficultyMarker
                                                currentLevel={diff?.level}
                                                currentTypes={diff?.types}
                                                onMark={(level, types) => handleDifficulty(langCode, level, types)}
                                            />
                                        </motion.div>
                                    )}
                                </div>
                            );
                        });
                })()}
            </div>
        </div>
    );
}
