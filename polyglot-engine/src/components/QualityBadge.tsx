"use client";

const BADGE_STYLES: Record<string, string> = {
    raw: "bg-gray-600/30 text-gray-300",
    reviewed: "bg-blue-600/30 text-blue-300",
    edited: "bg-yellow-600/30 text-yellow-300",
    gold: "bg-amber-500/30 text-amber-300",
    deprecated: "bg-red-600/30 text-red-300",
    suspicious: "bg-orange-600/30 text-orange-300",
};

export default function QualityBadge({ quality }: { quality: string }) {
    const style = BADGE_STYLES[quality] || BADGE_STYLES.raw;
    return (
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${style}`}>
            {quality}
        </span>
    );
}
