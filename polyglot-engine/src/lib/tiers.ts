import type { LangCode } from "./types";

export const TIER_MAP = {
    "Tier S": ["DE", "EN", "FR", "IT", "ES"] as const,
    "Tier A": ["JA", "KO", "ZH", "RU", "AR"] as const,
    "Tier B": ["SV", "NO", "NL", "DA", "FI"] as const,
    "Tier C": ["BCS", "HU", "CS", "PL", "TR"] as const,
    "Tier D": ["TH", "VI", "HE", "EL", "ID"] as const,
} as const;

export type TierName = keyof typeof TIER_MAP;

export const FAMILY_MAP = {
    germanic: ["DE", "EN", "NL", "SV", "NO", "DA"] as const,
    romance: ["FR", "IT", "ES"] as const,
    slavic: ["RU", "PL", "CS", "BCS"] as const,
    cjk: ["ZH", "JA", "KO"] as const,
    semitic: ["AR", "HE"] as const,
    uralic: ["FI", "HU"] as const,
    turkic: ["TR"] as const,
    southeast_asian: ["TH", "VI", "ID"] as const,
    hellenic: ["EL"] as const,
} as const;

export type FamilyName = keyof typeof FAMILY_MAP;

export const TIER_SRS_WEIGHT: Record<TierName, number> = {
    "Tier S": 1.0,
    "Tier A": 0.8,
    "Tier B": 0.5,
    "Tier C": 0.3,
    "Tier D": 0.2,
};

/** Get the tier for a given language code */
export function getTier(langCode: LangCode): TierName {
    for (const [tier, langs] of Object.entries(TIER_MAP)) {
        if ((langs as readonly string[]).includes(langCode)) {
            return tier as TierName;
        }
    }
    throw new Error(`Unknown language code: ${langCode}`);
}

/** Get the language family for a given language code */
export function getFamily(langCode: LangCode): FamilyName {
    for (const [family, langs] of Object.entries(FAMILY_MAP)) {
        if ((langs as readonly string[]).includes(langCode)) {
            return family as FamilyName;
        }
    }
    throw new Error(`Unknown language code: ${langCode}`);
}

/** Generation batches for split-by-family pipeline */
export const GENERATION_BATCHES = [
    { name: "romance", langs: ["FR", "IT", "ES"] },
    { name: "germanic", langs: ["DE", "EN", "NL", "SV", "NO", "DA"] },
    { name: "cjk", langs: ["JA", "KO", "ZH"] },
    { name: "slavic_uralic", langs: ["RU", "PL", "CS", "BCS", "FI", "HU"] },
    { name: "semitic_hellenic", langs: ["AR", "HE", "EL"] },
    { name: "turkic_sea", langs: ["TR", "TH", "VI", "ID"] },
] as const;
