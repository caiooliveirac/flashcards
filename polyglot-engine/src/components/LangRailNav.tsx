"use client";

import { Fragment, useEffect, useState } from "react";
import { langFlag, langName } from "@/lib/langFlags";

interface LangRailNavProps {
    langs: string[];
}

export default function LangRailNav({ langs }: LangRailNavProps) {
    const [active, setActive] = useState<string | null>(null);

    useEffect(() => {
        const visibleSet = new Set<string>();
        const observers: IntersectionObserver[] = [];

        langs.forEach((code) => {
            const el = document.getElementById(`lang-${code}`);
            if (!el) return;
            const obs = new IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) visibleSet.add(code);
                    else visibleSet.delete(code);
                    const first = langs.find((c) => visibleSet.has(c));
                    setActive(first ?? null);
                },
                { threshold: 0.15 }
            );
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach((o) => o.disconnect());
    }, [langs]);

    const jumpTo = (code: string) => {
        document.getElementById(`lang-${code}`)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    const jumpToEnd = () => {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    };

    return (
        <div
            className="fixed right-1.5 top-1/2 z-50 -translate-y-1/2 flex flex-col items-center gap-px rounded-2xl border border-white/10 bg-black/60 px-0.5 py-1.5 backdrop-blur-md overflow-y-auto select-none [&::-webkit-scrollbar]:hidden"
            style={{ maxHeight: "calc(100dvh - 120px)", scrollbarWidth: "none" }}
        >
            {langs.map((code, idx) => (
                <Fragment key={code}>
                    {idx > 0 && idx % 5 === 0 && (
                        <div className="my-0.5 h-px w-4 shrink-0 bg-white/15" />
                    )}
                    <button
                        onClick={() => jumpTo(code)}
                        title={langName(code)}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[15px] leading-none transition-all active:scale-90 ${
                            active === code
                                ? "bg-white/25 scale-110"
                                : "opacity-45 hover:opacity-90 hover:bg-white/10"
                        }`}
                    >
                        {langFlag(code)}
                    </button>
                </Fragment>
            ))}
            <div className="my-0.5 h-px w-4 shrink-0 bg-white/15" />
            <button
                onClick={jumpToEnd}
                title="Ir ao final"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs opacity-45 hover:opacity-90 hover:bg-white/10 transition-all active:scale-90"
            >
                ↓
            </button>
        </div>
    );
}
