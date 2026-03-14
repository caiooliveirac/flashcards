"use client";

const LEVELS = [
    { value: "easy", emoji: "🟢", label: "Fácil" },
    { value: "medium", emoji: "🟡", label: "Médio" },
    { value: "hard", emoji: "🔴", label: "Difícil" },
    { value: "blocked", emoji: "⬛", label: "Travado" },
] as const;

const TYPES = [
    "pronuncia", "escrita", "gramatica", "vocabulario",
    "interferencia", "tom", "caso", "ordem",
] as const;

const TYPE_LABELS: Record<string, string> = {
    pronuncia: "🗣️ Pronúncia",
    escrita: "✍️ Escrita",
    gramatica: "📐 Gramática",
    vocabulario: "📚 Vocabulário",
    interferencia: "🔄 Interferência",
    tom: "🎵 Tom",
    caso: "🏷️ Caso",
    ordem: "📋 Ordem",
};

export default function DifficultyMarker({
    currentLevel,
    currentTypes,
    onMark,
}: {
    currentLevel?: string | null;
    currentTypes?: string[];
    onMark: (level: string, types: string[]) => void;
}) {
    const activeLevel = currentLevel || null;
    const activeTypes = currentTypes || [];

    const handleLevel = (level: string) => {
        if (activeLevel === level) {
            onMark("easy", []);
        } else {
            onMark(level, activeTypes);
        }
    };

    const handleType = (type: string) => {
        const next = activeTypes.includes(type)
            ? activeTypes.filter((t) => t !== type)
            : [...activeTypes, type];
        onMark(activeLevel || "medium", next);
    };

    return (
        <div className="space-y-2">
            {/* Level buttons */}
            <div className="flex gap-2">
                {LEVELS.map((l) => (
                    <button
                        key={l.value}
                        onClick={() => handleLevel(l.value)}
                        className={`tap-scale flex-1 rounded-lg py-2 text-center text-lg transition-all ${activeLevel === l.value
                                ? "bg-white/15 ring-1 ring-white/30 scale-105"
                                : "bg-white/5 hover:bg-white/10"
                            }`}
                        title={l.label}
                    >
                        {l.emoji}
                    </button>
                ))}
            </div>

            {/* Type chips — shown when level is medium+ */}
            {activeLevel && activeLevel !== "easy" && (
                <div className="flex flex-wrap gap-1.5">
                    {TYPES.map((type) => (
                        <button
                            key={type}
                            onClick={() => handleType(type)}
                            className={`tap-scale rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${activeTypes.includes(type)
                                    ? "bg-white/20 text-white ring-1 ring-white/30"
                                    : "bg-white/5 text-gray-400"
                                }`}
                        >
                            {TYPE_LABELS[type]}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
