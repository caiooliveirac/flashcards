"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
    { href: "/", icon: "🏠", label: "Home" },
    { href: "/study", icon: "📚", label: "Estudar" },
    { href: "/grammar", icon: "📖", label: "Gramática" },
    { href: "/browse", icon: "🔍", label: "Explorar" },
    { href: "/stats", icon: "📊", label: "Stats" },
];

export default function BottomNav() {
    const pathname = usePathname();
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

    const isActive = (href: string) => {
        const full = basePath + href;
        if (href === "/") return pathname === "/" || pathname === full;
        return pathname?.startsWith(href) || pathname?.startsWith(full);
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--card-border)] bg-[var(--background)]/95 backdrop-blur-md safe-bottom">
            <div className="mx-auto flex max-w-lg">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`tap-scale flex flex-1 flex-col items-center gap-0.5 py-2 text-center transition-colors ${active ? "text-blue-400" : "text-gray-600"
                                }`}
                        >
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
