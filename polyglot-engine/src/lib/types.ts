import type {
    CardType,
    Nivel,
    Categoria,
    CardSource,
    CardQuality,
    DifficultyLevel,
    DifficultyType,
    GenerationStatus,
} from "@prisma/client";

export type {
    CardType,
    Nivel,
    Categoria,
    CardSource,
    CardQuality,
    DifficultyLevel,
    DifficultyType,
    GenerationStatus,
};

/** All 25 language codes used in the system */
export const LANG_CODES = [
    "DE", "EN", "FR", "IT", "ES",
    "JA", "KO", "ZH", "RU", "AR",
    "SV", "NO", "NL", "DA", "FI",
    "BCS", "HU", "CS", "PL", "TR",
    "TH", "VI", "HE", "EL", "ID",
] as const;

export type LangCode = (typeof LANG_CODES)[number];

/** BCP 47 tags for Web Speech API */
export const LANG_TO_BCP47: Record<LangCode, string> = {
    DE: "de-DE", EN: "en-GB", FR: "fr-FR", IT: "it-IT", ES: "es-ES",
    JA: "ja-JP", KO: "ko-KR", ZH: "zh-CN", RU: "ru-RU", AR: "ar-SA",
    SV: "sv-SE", NO: "nb-NO", NL: "nl-NL", DA: "da-DK", FI: "fi-FI",
    BCS: "sr-RS", HU: "hu-HU", CS: "cs-CZ", PL: "pl-PL", TR: "tr-TR",
    TH: "th-TH", VI: "vi-VN", HE: "he-IL", EL: "el-GR", ID: "id-ID",
};

/** Non-Latin script languages that MUST have romanization */
export const NON_LATIN_LANGS: LangCode[] = ["JA", "KO", "ZH", "RU", "AR", "TH", "HE", "EL"];

/** FSRS rating values */
export const RATING = {
    AGAIN: 1,
    HARD: 2,
    GOOD: 3,
    EASY: 4,
} as const;

export type Rating = (typeof RATING)[keyof typeof RATING];

/** FSRS card states */
export const CARD_STATE = {
    NEW: 0,
    LEARNING: 1,
    REVIEW: 2,
    RELEARNING: 3,
} as const;

export type CardState = (typeof CARD_STATE)[keyof typeof CARD_STATE];
