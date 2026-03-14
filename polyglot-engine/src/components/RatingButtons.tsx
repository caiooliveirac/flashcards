"use client";

import { motion } from "framer-motion";

const LABELS: Record<number, { text: string; color: string; bg: string }> = {
    1: { text: "Errei", color: "text-red-100", bg: "bg-red-600 active:bg-red-700" },
    2: { text: "Difícil", color: "text-orange-100", bg: "bg-orange-600 active:bg-orange-700" },
    3: { text: "Bom", color: "text-green-100", bg: "bg-green-600 active:bg-green-700" },
    4: { text: "Fácil", color: "text-blue-100", bg: "bg-blue-600 active:bg-blue-700" },
};

export default function RatingButtons({
    onRate,
    disabled,
    intervals,
}: {
    onRate: (rating: number) => void;
    disabled?: boolean;
    intervals?: Record<number, string>;
}) {
    return (
        <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((r) => {
                const label = LABELS[r];
                return (
                    <motion.button
                        key={r}
                        whileTap={{ scale: 0.9 }}
                        disabled={disabled}
                        onClick={() => onRate(r)}
                        className={`tap-scale flex flex-col items-center justify-center rounded-xl py-3 px-1 font-semibold ${label.bg} ${label.color} ${disabled ? "opacity-40 cursor-not-allowed" : ""
                            }`}
                    >
                        <span className="text-sm">{label.text}</span>
                        {intervals?.[r] && (
                            <span className="mt-0.5 text-[10px] opacity-70">{intervals[r]}</span>
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}
