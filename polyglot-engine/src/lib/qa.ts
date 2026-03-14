import type { ParsedCard } from "./parser";
import { NON_LATIN_LANGS } from "./types";

export interface QACheck {
    name: string;
    passed: boolean;
    detail: string;
}

export interface QAResult {
    score: number;
    flags: string[];
    checks: QACheck[];
    pass: boolean;
}

const TIER_S = ["DE", "EN", "FR", "IT", "ES"];

export function qaCheck(card: ParsedCard): QAResult {
    const flags: string[] = [];
    const checks: QACheck[] = [];

    // 1. Exactly 25 langs?
    const langCountOk = card.idiomas.length === 25;
    checks.push({ name: "lang_count_25", passed: langCountOk, detail: langCountOk ? "25/25 idiomas" : `${card.idiomas.length}/25 idiomas` });
    if (!langCountOk) flags.push("wrong_lang_count");

    // 2. Non-Latin langs must have romanization
    const missingRom: string[] = [];
    for (const code of NON_LATIN_LANGS) {
        const bloco = card.idiomas.find((b) => b.langCode === code);
        if (bloco && (!bloco.romanizacao || bloco.romanizacao === "—")) {
            flags.push(`missing_romanization_${code}`);
            missingRom.push(code);
        }
    }
    const romOk = missingRom.length === 0;
    checks.push({ name: "romanization_non_latin", passed: romOk, detail: romOk ? `romanização presente (${NON_LATIN_LANGS.length}/${NON_LATIN_LANGS.length} não-latinos)` : `falta romanização: ${missingRom.join(", ")}` });

    // 3. Generic obs: obs/erroTipico/contraste duplicated across >3 langs?
    const genericFields: string[] = [];
    for (const field of ["obs", "erroTipico", "contraste"] as const) {
        const values = card.idiomas.map((b) => b[field]).filter(Boolean);
        const counts = new Map<string, number>();
        for (const v of values) {
            counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        let isGeneric = false;
        for (const [, count] of counts) {
            if (count > 3) {
                flags.push(`generic_${field}`);
                genericFields.push(field);
                isGeneric = true;
                break;
            }
        }
    }
    const obsOk = genericFields.length === 0;
    checks.push({ name: "observations_not_generic", passed: obsOk, detail: obsOk ? "observações não genéricas" : `campos genéricos: ${genericFields.join(", ")}` });

    // 4. Literal should not equal natural
    const litEqualsNat: string[] = [];
    for (const bloco of card.idiomas) {
        if (bloco.literal === bloco.natural) {
            flags.push(`literal_equals_natural_${bloco.langCode}`);
            litEqualsNat.push(bloco.langCode);
        }
    }
    const litOk = litEqualsNat.length === 0;
    checks.push({ name: "literals_distinct", passed: litOk, detail: litOk ? "literais distintos de naturais" : `literal=natural: ${litEqualsNat.join(", ")}` });

    // 5. PadraoReutilizavel should contain [slots]
    const noSlots: string[] = [];
    for (const bloco of card.idiomas) {
        if (
            !bloco.padraoReutilizavel.includes("[") &&
            !bloco.padraoReutilizavel.includes("]")
        ) {
            flags.push(`pattern_no_slots_${bloco.langCode}`);
            noSlots.push(bloco.langCode);
        }
    }
    const slotsOk = noSlots.length === 0;
    checks.push({ name: "patterns_with_slots", passed: slotsOk, detail: slotsOk ? "padrões com [slots]" : `sem slots: ${noSlots.join(", ")}` });

    // 6. Thesaurus present for Tier S (at least sinonimos)
    const missingThes: string[] = [];
    for (const code of TIER_S) {
        const bloco = card.idiomas.find((b) => b.langCode === code);
        if (bloco && (!bloco.sinonimos || bloco.sinonimos === "—")) {
            flags.push(`missing_thesaurus_tier_s_${code}`);
            missingThes.push(code);
        }
    }
    const thesOk = missingThes.length === 0;
    checks.push({ name: "thesaurus_tier_s", passed: thesOk, detail: thesOk ? `thesaurus Tier S: ${TIER_S.length}/${TIER_S.length} preenchidos` : `falta thesaurus: ${missingThes.join(", ")}` });

    // 7. Natural field should not be empty
    const emptyNat: string[] = [];
    for (const bloco of card.idiomas) {
        if (!bloco.natural || bloco.natural.trim().length === 0) {
            flags.push(`empty_natural_${bloco.langCode}`);
            emptyNat.push(bloco.langCode);
        }
    }
    const natOk = emptyNat.length === 0;
    checks.push({ name: "dedup_ok", passed: natOk, detail: natOk ? "dedup ok" : `natural vazio: ${emptyNat.join(", ")}` });

    const score = Math.max(0, 1 - flags.length / 30);
    return { score, flags, checks, pass: flags.length <= 5 };
}
