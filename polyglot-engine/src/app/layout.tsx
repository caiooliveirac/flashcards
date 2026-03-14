import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
    title: "PolyGlot Engine",
    description: "Plataforma pessoal de flashcards multilíngues",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "PolyGlot",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: "#0a0a0a",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body className="min-h-dvh bg-[var(--background)] text-[var(--foreground)]">
                <main className="mx-auto max-w-lg px-4 pt-3 pb-20">
                    {children}
                </main>
                <BottomNav />
            </body>
        </html>
    );
}
