import { ValidationError } from "totoms";
import { EXERCISE_TYPES, GRAMMAR_LINKED_TYPES, PROMPT_TRANSLATION_REQUIRED_TYPES, VOCAB_LINKED_TYPES } from "../model/Exercise";

export interface ParsedExerciseInput {
    type: string;
    prompt: string;
    promptTranslation: string | null;
    answer: string;
    alternativeAnswers: string[];
    words: string[] | null;
    distractors: string[] | null;
    vocabularyItemId: string | null;
    grammarConceptId: string | null;
}

/**
 * Validates and parses a single exercise input object from a request body.
 * Enforces type validity, required fields, and the vocabularyItemId/grammarConceptId linkage rule.
 * Throws ValidationError on any violation.
 *
 * @param ex - Raw exercise object from the request body
 * @param index - Position in the exercises array (used in error messages)
 */
export function parseExerciseInput(ex: any, index: number): ParsedExerciseInput {

    const prefix = `exercises[${index}]`;

    if (!ex.type || !(EXERCISE_TYPES as readonly string[]).includes(ex.type)) {
        throw new ValidationError(400, `${prefix}.type must be one of: ${EXERCISE_TYPES.join(", ")}`);
    }

    if (!ex.prompt) throw new ValidationError(400, `${prefix}.prompt is required`);
    if (!ex.answer) throw new ValidationError(400, `${prefix}.answer is required`);

    const hasVocabId = !!ex.vocabularyItemId;
    const hasGrammarId = !!ex.grammarConceptId;

    if (hasVocabId && hasGrammarId) throw new ValidationError(400, `${prefix}: exactly one of vocabularyItemId / grammarConceptId must be set, not both`);
    if (!hasVocabId && !hasGrammarId) throw new ValidationError(400, `${prefix}: exactly one of vocabularyItemId / grammarConceptId must be set`);

    if ((VOCAB_LINKED_TYPES as readonly string[]).includes(ex.type) && !hasVocabId) {
        throw new ValidationError(400, `${prefix}: type '${ex.type}' requires vocabularyItemId`);
    }

    if ((GRAMMAR_LINKED_TYPES as readonly string[]).includes(ex.type) && !hasGrammarId) {
        throw new ValidationError(400, `${prefix}: type '${ex.type}' requires grammarConceptId`);
    }

    if ((PROMPT_TRANSLATION_REQUIRED_TYPES as readonly string[]).includes(ex.type) && !ex.promptTranslation) {
        throw new ValidationError(400, `${prefix}: type '${ex.type}' requires promptTranslation`);
    }

    if (ex.type === "sentence_reorder" && (!Array.isArray(ex.words) || ex.words.length === 0)) {
        throw new ValidationError(400, `${prefix}: type 'sentence_reorder' requires a non-empty words array`);
    }

    if (ex.type === "multiple_choice" && (!Array.isArray(ex.distractors) || ex.distractors.length === 0)) {
        throw new ValidationError(400, `${prefix}: type 'multiple_choice' requires a non-empty distractors array`);
    }

    return {
        type: ex.type,
        prompt: ex.prompt,
        promptTranslation: ex.promptTranslation ?? null,
        answer: ex.answer,
        alternativeAnswers: Array.isArray(ex.alternativeAnswers) ? ex.alternativeAnswers : [],
        words: Array.isArray(ex.words) ? ex.words : null,
        distractors: Array.isArray(ex.distractors) ? ex.distractors : null,
        vocabularyItemId: ex.vocabularyItemId ?? null,
        grammarConceptId: ex.grammarConceptId ?? null,
    };
}
