import { Exercise } from "../model/Exercise";

/**
 * Exercise types for which fuzzy (Levenshtein) matching is applied after exact
 * comparison fails. Only free-text production types qualify — selection-based
 * types (multiple_choice, sentence_reorder) and precision-typed types
 * (fill_blank, conjugation_drill) use exact matching only.
 */
export const FUZZY_TYPES = ["translation_active", "error_correction"] as const;

export interface CheckAnswerResult {
    isCorrect: boolean;
    correctAnswer: string;
    fuzzyMatched: boolean;
}

/**
 * Normalizes an answer string for comparison: lowercases it, strips leading/trailing
 * whitespace, and removes punctuation characters.
 */
export function normalize(answer: string): string {

    return answer
        .toLowerCase()
        .trim()
        .replace(/[.,!?;:'"()\-]/g, "")
        .trim();
}

/**
 * Computes the Levenshtein edit distance between two strings using the
 * Wagner-Fischer dynamic programming algorithm.
 */
export function levenshtein(a: string, b: string): number {

    const m = a.length;
    const n = b.length;

    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
            }
        }
    }

    return dp[m][n];
}

/**
 * Returns the maximum number of edit operations (insertions, deletions,
 * substitutions) that are tolerated for a fuzzy match, based on the length
 * of the normalized accepted answer:
 *   ≤ 10 chars → 1 edit
 *   ≤ 20 chars → 2 edits
 *    > 20 chars → 3 edits
 */
export function fuzzyThreshold(normalizedAnswer: string): number {

    if (normalizedAnswer.length <= 10) return 1;
    if (normalizedAnswer.length <= 20) return 2;

    return 3;
}

/**
 * Checks whether a user's answer is correct for a given exercise.
 *
 * First performs an exact normalized comparison against the exercise's canonical
 * answer, alternativeAnswers, and userContributedAnswers. If that fails and the
 * exercise type is in FUZZY_TYPES, retries with Levenshtein distance ≤
 * fuzzyThreshold(acceptedAnswer) for each accepted answer.
 *
 * Returns the canonical answer as correctAnswer regardless of which variant
 * matched. fuzzyMatched is true only when a fuzzy (non-exact) match was accepted.
 *
 * @param userAnswer - The raw answer submitted by the user
 * @param exercise - The exercise being answered
 */
export function checkAnswer(userAnswer: string, exercise: Exercise): CheckAnswerResult {

    const normalized = normalize(userAnswer);

    const allAccepted = [
        exercise.answer,
        ...exercise.alternativeAnswers,
        ...exercise.userContributedAnswers,
    ].map(normalize);

    if (allAccepted.includes(normalized)) {
        return { isCorrect: true, correctAnswer: exercise.answer, fuzzyMatched: false };
    }

    const isFuzzyType = (FUZZY_TYPES as readonly string[]).includes(exercise.type);

    if (isFuzzyType) {

        for (const accepted of allAccepted) {

            if (levenshtein(normalized, accepted) <= fuzzyThreshold(accepted)) {
                return { isCorrect: true, correctAnswer: exercise.answer, fuzzyMatched: true };
            }
        }
    }

    return { isCorrect: false, correctAnswer: exercise.answer, fuzzyMatched: false };
}
