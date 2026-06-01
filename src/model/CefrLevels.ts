export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = typeof CEFR_LEVELS[number];

/**
 * Returns the next CEFR level after the given one, or null if the given level is C2.
 */
export function nextLevel(current: CefrLevel): CefrLevel | null {

    const idx = CEFR_LEVELS.indexOf(current);

    if (idx === -1 || idx === CEFR_LEVELS.length - 1) return null;

    return CEFR_LEVELS[idx + 1];
}

/**
 * Type guard that returns true if the given string is a valid CEFR level.
 */
export function isValidCefrLevel(value: string): value is CefrLevel {

    return (CEFR_LEVELS as readonly string[]).includes(value);
}
