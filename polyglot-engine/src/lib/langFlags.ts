/** Maps each language code to its primary flag emoji + full name. */
export const LANG_FLAG: Record<string, { flag: string; name: string }> = {
    // Tier S
    DE: { flag: "🇩🇪", name: "Alemão" },
    EN: { flag: "🇬🇧", name: "Inglês" },
    FR: { flag: "🇫🇷", name: "Francês" },
    IT: { flag: "🇮🇹", name: "Italiano" },
    ES: { flag: "🇪🇸", name: "Espanhol" },
    // Tier A
    JA: { flag: "🇯🇵", name: "Japonês" },
    KO: { flag: "🇰🇷", name: "Coreano" },
    ZH: { flag: "🇨🇳", name: "Chinês" },
    RU: { flag: "🇷🇺", name: "Russo" },
    AR: { flag: "🇸🇦", name: "Árabe" },
    // Tier B
    SV: { flag: "🇸🇪", name: "Sueco" },
    NO: { flag: "🇳🇴", name: "Norueguês" },
    NL: { flag: "🇳🇱", name: "Holandês" },
    DA: { flag: "🇩🇰", name: "Dinamarquês" },
    FI: { flag: "🇫🇮", name: "Finlandês" },
    // Tier C
    BCS: { flag: "🇷🇸", name: "Sérvio/Croata" },
    HU: { flag: "🇭🇺", name: "Húngaro" },
    CS: { flag: "🇨🇿", name: "Tcheco" },
    PL: { flag: "🇵🇱", name: "Polonês" },
    TR: { flag: "🇹🇷", name: "Turco" },
    // Tier D
    TH: { flag: "🇹🇭", name: "Tailandês" },
    VI: { flag: "🇻🇳", name: "Vietnamita" },
    HE: { flag: "🇮🇱", name: "Hebraico" },
    EL: { flag: "🇬🇷", name: "Grego" },
    ID: { flag: "🇮🇩", name: "Indonésio" },
};

export function langFlag(code: string): string {
    return LANG_FLAG[code]?.flag ?? code;
}

export function langName(code: string): string {
    return LANG_FLAG[code]?.name ?? code;
}
