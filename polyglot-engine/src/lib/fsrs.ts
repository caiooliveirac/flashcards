import type { Rating, CardState } from "./types";
import { CARD_STATE, RATING } from "./types";

/**
 * FSRS-5 implementation.
 * Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

export interface FSRSState {
    stability: number;
    difficulty: number;
    due: Date;
    interval: number;
    reps: number;
    lapses: number;
    state: CardState;
}

/** Default FSRS-5 parameters (19 weights) */
export const DEFAULT_PARAMS = {
    w: [
        0.4, 0.6, 2.4, 5.8, // initial stability for Again, Hard, Good, Easy
        4.93, 0.94, 0.86, 0.01,  // difficulty params
        1.49, 0.14, 0.94,         // stability after forgetting
        2.18, 0.05, 0.34, 1.26,  // recall params
        0.29, 2.61,               // hardFactor, easyBonus
        0.0, 0.0,                 // reserved
    ],
    requestRetention: 0.9,
    maximumInterval: 36500,
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function initDifficulty(rating: Rating, w: number[]): number {
    return clamp(w[4] - Math.exp(w[5] * (rating - 1)) + 1, 1, 10);
}

function nextDifficulty(d: number, rating: Rating, w: number[]): number {
    const delta = d - w[4] * (Math.exp(w[5] * (rating - 1)) - 1);
    const meanRevert = w[7] * (w[4] - delta) + delta;
    return clamp(meanRevert, 1, 10);
}

function initStability(rating: Rating, w: number[]): number {
    return Math.max(w[rating - 1], 0.1);
}

function nextRecallStability(
    d: number,
    s: number,
    r: number,
    rating: Rating,
    w: number[]
): number {
    const hardPenalty = rating === RATING.HARD ? w[15] : 1;
    const easyBonus = rating === RATING.EASY ? w[16] : 1;
    return (
        s *
        (1 +
            Math.exp(w[8]) *
            (11 - d) *
            Math.pow(s, -w[9]) *
            (Math.exp((1 - r) * w[10]) - 1) *
            hardPenalty *
            easyBonus)
    );
}

function nextForgetStability(
    d: number,
    s: number,
    r: number,
    w: number[]
): number {
    return (
        w[11] *
        Math.pow(d, -w[12]) *
        (Math.pow(s + 1, w[13]) - 1) *
        Math.exp((1 - r) * w[14])
    );
}

function nextInterval(s: number, requestRetention: number, maxIvl: number): number {
    const ivl = (s / 9) * (1 / requestRetention - 1);
    return Math.min(Math.max(Math.round(ivl), 1), maxIvl);
}

function retrievability(elapsed: number, stability: number): number {
    if (stability <= 0) return 0;
    return Math.pow(1 + elapsed / (9 * stability), -1);
}

export function schedule(
    prev: FSRSState,
    rating: Rating,
    now: Date = new Date(),
    params = DEFAULT_PARAMS
): FSRSState {
    const w = params.w;
    const { requestRetention, maximumInterval } = params;

    // New card
    if (prev.state === CARD_STATE.NEW) {
        const d = initDifficulty(rating, w);
        const s = initStability(rating, w);

        if (rating === RATING.AGAIN) {
            return {
                stability: s,
                difficulty: d,
                due: new Date(now.getTime() + 60_000), // 1 min
                interval: 0,
                reps: prev.reps + 1,
                lapses: prev.lapses + 1,
                state: CARD_STATE.LEARNING,
            };
        }

        const ivl = nextInterval(s, requestRetention, maximumInterval);
        return {
            stability: s,
            difficulty: d,
            due: new Date(now.getTime() + ivl * 86_400_000),
            interval: ivl,
            reps: prev.reps + 1,
            lapses: prev.lapses,
            state: CARD_STATE.REVIEW,
        };
    }

    // Learning / Relearning
    if (prev.state === CARD_STATE.LEARNING || prev.state === CARD_STATE.RELEARNING) {
        const d = nextDifficulty(prev.difficulty, rating, w);
        const s = initStability(rating, w);

        if (rating === RATING.AGAIN) {
            return {
                stability: s,
                difficulty: d,
                due: new Date(now.getTime() + 60_000),
                interval: 0,
                reps: prev.reps + 1,
                lapses: prev.lapses + 1,
                state: prev.state,
            };
        }

        const ivl = nextInterval(s, requestRetention, maximumInterval);
        return {
            stability: s,
            difficulty: d,
            due: new Date(now.getTime() + ivl * 86_400_000),
            interval: ivl,
            reps: prev.reps + 1,
            lapses: prev.lapses,
            state: CARD_STATE.REVIEW,
        };
    }

    // Review state
    const elapsed = (now.getTime() - prev.due.getTime()) / 86_400_000 + prev.interval;
    const r = retrievability(Math.max(elapsed, 0), prev.stability);

    const d = nextDifficulty(prev.difficulty, rating, w);

    if (rating === RATING.AGAIN) {
        const s = nextForgetStability(d, prev.stability, r, w);
        return {
            stability: s,
            difficulty: d,
            due: new Date(now.getTime() + 60_000),
            interval: 0,
            reps: prev.reps + 1,
            lapses: prev.lapses + 1,
            state: CARD_STATE.RELEARNING,
        };
    }

    const s = nextRecallStability(d, prev.stability, r, rating, w);
    const ivl = nextInterval(s, requestRetention, maximumInterval);

    return {
        stability: s,
        difficulty: d,
        due: new Date(now.getTime() + ivl * 86_400_000),
        interval: ivl,
        reps: prev.reps + 1,
        lapses: prev.lapses,
        state: CARD_STATE.REVIEW,
    };
}

/** Create initial FSRSState for a new card */
export function newFSRSState(): FSRSState {
    return {
        stability: 0,
        difficulty: 0,
        due: new Date(),
        interval: 0,
        reps: 0,
        lapses: 0,
        state: CARD_STATE.NEW,
    };
}

/** Sort reviews by due date ascending, suitable for study queue */
export function getDueCards(
    reviews: Array<{ due: Date; cardId: string; langCode: string | null }>,
    now: Date = new Date()
): Array<{ due: Date; cardId: string; langCode: string | null }> {
    return reviews
        .filter((r) => r.due <= now)
        .sort((a, b) => a.due.getTime() - b.due.getTime());
}
