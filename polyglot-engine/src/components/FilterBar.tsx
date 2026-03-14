"use client";

import { LANG_CODES } from "@/lib/types";

const TIER_OPTIONS = ["S", "A", "B", "C", "D"];
const NIVEL_OPTIONS = ["a1", "a2", "b1", "b2", "c1"];

interface Filters {
    lang?: string;
    tier?: string;
    nivel?: string;
    q?: string;
}

export default function FilterBar({
    filters,
    onChange,
    showSearch = false,
}: {
    filters: Filters;
    onChange: (f: Filters) => void;
    showSearch?: boolean;
}) {
    const chipClass = (active: boolean) =>
        `tap-scale shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${active
            ? "bg-blue-600 text-white"
            : "bg-white/5 text-gray-400 active:bg-white/10"
        }`;

    return (
        <div className="space-y-2">
            {/* Search bar */}
            {showSearch && (
                <input
                    type="text"
                    placeholder="Buscar cards..."
                    value={filters.q || ""}
                    onChange={(e) => onChange({ ...filters, q: e.target.value })}
                    className="w-full rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                />
            )}

            {/* Tier chips — horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                    onClick={() => onChange({ ...filters, tier: undefined })}
                    className={chipClass(!filters.tier)}
                >
                    Todos
                </button>
                {TIER_OPTIONS.map((t) => (
                    <button
                        key={t}
                        onClick={() => onChange({ ...filters, tier: filters.tier === t ? undefined : t })}
                        className={chipClass(filters.tier === t)}
                    >
                        Tier {t}
                    </button>
                ))}
            </div>

            {/* Lang chips — horizontal scroll */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                    onClick={() => onChange({ ...filters, lang: undefined })}
                    className={chipClass(!filters.lang)}
                >
                    🌐
                </button>
                {LANG_CODES.map((l) => (
                    <button
                        key={l}
                        onClick={() => onChange({ ...filters, lang: filters.lang === l ? undefined : l })}
                        className={chipClass(filters.lang === l)}
                    >
                        {l}
                    </button>
                ))}
            </div>

            {/* Nivel chips */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                <button
                    onClick={() => onChange({ ...filters, nivel: undefined })}
                    className={chipClass(!filters.nivel)}
                >
                    Nível
                </button>
                {NIVEL_OPTIONS.map((n) => (
                    <button
                        key={n}
                        onClick={() => onChange({ ...filters, nivel: filters.nivel === n ? undefined : n })}
                        className={chipClass(filters.nivel === n)}
                    >
                        {n.toUpperCase()}
                    </button>
                ))}
            </div>
        </div>
    );
}
