import { normalize } from "./AnswerChecker";

const LEADING_ARTICLE = /^(at|en|et) /;

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
