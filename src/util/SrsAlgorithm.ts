/**
 * Pure SRS (Spaced Repetition System) scoring algorithm.
 *
 * A correct answer nudges the score towards 1.0 with diminishing returns
 * (the closer to mastery, the smaller the gain). An incorrect answer pulls
 * the score down proportionally to its current value (the higher the score,
 * the bigger the drop). Both adjustments are clamped to [0.0, 1.0].
 */
export const MASTERY_INCREMENT = 0.12;
export const MASTERY_DECREMENT = 0.18;
export const MASTERY_THRESHOLD = 0.8;

export function applyCorrect(score: number, increment: number = MASTERY_INCREMENT): number {
    return clamp(score + increment * (1 - score));
}

export function applyIncorrect(score: number, decrement: number = MASTERY_DECREMENT): number {
    return clamp(score - decrement * score);
}

export function isMastered(score: number, threshold: number = MASTERY_THRESHOLD): boolean {
    return score >= threshold;
}

function clamp(score: number): number {
    return Math.min(1.0, Math.max(0.0, score));
}
