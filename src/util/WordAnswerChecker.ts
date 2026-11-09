import { fuzzyThreshold, levenshtein, normalize } from "./AnswerChecker";

const LEADING_ARTICLE = /^(at|en|et) /;

/**
 * Canonical forms up to this length are matched exactly: one edit apart is usually another real
 * word (`mad`/`med`, `gå`/`få`, `kan`/`kat`).
 */
const EXACT_MATCH_MAX_LENGTH = 4;

export interface CheckWordAnswerInput {
    userAnswer: string;     // The raw answer submitted by the user.
    canonical: string;      // The canonical Danish form of the word.
}

/**
 * Normalizes a single Danish word (or short phrase) for comparison and grouping (F26).
 *
 * Applies the exercise normalization (lowercase, punctuation stripped, trimmed) and then removes
 * one leading `at `, `en ` or `et `, so `at arbejde`, `Arbejde.` and `arbejde` are the same word
 * and `et hus` equals `hus`. A bare article (`en`) and article-like prefixes inside a word
 * (`enhed`, `atlas`) are left untouched.
 *
 * @param {string} value - The raw Danish text, either a user answer or a vocabulary item's `danish`.
 *
 * @returns {string} The normalized form.
 */
export function normalizeWord(value: string): string {

    return normalize(value).replace(LEADING_ARTICLE, "").trim();
}

/**
 * Judges a typed answer to a single word (F26).
 *
 * Both sides are normalized with {@link normalizeWord}. An exact normalized match is correct.
 * Otherwise a canonical form of 4 characters or fewer is wrong (no fuzzy slack), and a longer one
 * is correct when the Levenshtein distance is within the existing `fuzzyThreshold`.
 *
 * Only the canonical `danish` is matched; valid synonyms are rescued only by the AI check (F27).
 *
 * @param {CheckWordAnswerInput} input - The user's answer and the canonical form.
 *
 * @returns {boolean} True when the answer is accepted.
 */
export function checkWordAnswer(input: CheckWordAnswerInput): boolean {

    const answer = normalizeWord(input.userAnswer);
    const canonical = normalizeWord(input.canonical);

    if (answer.length === 0) return false;
    if (answer === canonical) return true;
    if (canonical.length <= EXACT_MATCH_MAX_LENGTH) return false;

    return levenshtein(answer, canonical) <= fuzzyThreshold(canonical);
}
