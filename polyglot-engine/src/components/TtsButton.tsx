"use client";

import { useState, useCallback } from "react";
import { LANG_TO_BCP47 } from "@/lib/types";
import type { LangCode } from "@/lib/types";

export default function TtsButton({
    text,
    langCode,
    size = "md",
}: {
    text: string;
    langCode: LangCode;
    size?: "sm" | "md" | "lg";
}) {
    const [playing, setPlaying] = useState(false);
    const [available, setAvailable] = useState(true);

    const speak = useCallback(() => {
        if (!available || playing) return;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = LANG_TO_BCP47[langCode];
        utterance.rate = 0.85;
        utterance.onstart = () => setPlaying(true);
        utterance.onend = () => setPlaying(false);
        utterance.onerror = () => {
            setPlaying(false);
            setAvailable(false);
        };
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    }, [text, langCode, available, playing]);

    const sizeClass = size === "sm" ? "text-base p-1" : size === "lg" ? "text-2xl p-2" : "text-xl p-1.5";

    return (
        <button
            onClick={speak}
            disabled={!available}
            className={`tap-scale rounded-full transition-all ${sizeClass} ${!available
                    ? "opacity-30 cursor-not-allowed"
                    : playing
                        ? "animate-pulse text-blue-400"
                        : "active:bg-white/10"
                }`}
            aria-label={`Ouvir em ${langCode}`}
        >
            {playing ? "🔉" : "🔊"}
        </button>
    );
}
