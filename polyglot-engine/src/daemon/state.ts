// Daemon state — shared between daemon process and (in Docker) the Next.js API
// In Docker, daemon runs as a separate process, so the API reads from DB.
// This module is used by the daemon to track its own state for logging.

export interface DaemonState {
    enabled: boolean;
    startedAt: number; // Date.now()
    lastTickAt: number | null;
    nextTickAt: number | null;
    currentState: "idle" | "generating" | "paused";
    intervalMs: number;
    currentChunk: string | null;
}

export const daemonState: DaemonState = {
    enabled: true,
    startedAt: Date.now(),
    lastTickAt: null,
    nextTickAt: null,
    currentState: "idle",
    intervalMs: parseInt(process.env.GENERATION_INTERVAL_MS ?? "120000", 10),
    currentChunk: null,
};

// Haiku 4.5 pricing per million tokens
const HAIKU_INPUT_PER_M = 0.80;
const HAIKU_OUTPUT_PER_M = 4.00;
const HAIKU_CACHE_WRITE_PER_M = 1.00;
const HAIKU_CACHE_READ_PER_M = 0.08;

export function calculateCost(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
}): number {
    const cacheRead = usage.cache_read_input_tokens ?? 0;
    const cacheWrite = usage.cache_creation_input_tokens ?? 0;
    const regularInput = usage.input_tokens - cacheRead - cacheWrite;

    return (
        (regularInput / 1_000_000) * HAIKU_INPUT_PER_M +
        (usage.output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_M +
        (cacheRead / 1_000_000) * HAIKU_CACHE_READ_PER_M +
        (cacheWrite / 1_000_000) * HAIKU_CACHE_WRITE_PER_M
    );
}
