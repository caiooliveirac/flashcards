/**
 * Normalizes a Portuguese front text for dedup.
 * Lowercase, trim, remove punctuation.
 */
export function normalizeFrentePt(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove diacritics
        .replace(/[^\w\s]/g, "")         // remove punctuation
        .replace(/\s+/g, " ")            // collapse whitespace
        .trim();
}
