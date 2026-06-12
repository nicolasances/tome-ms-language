import { Exercise } from "../model/Exercise";

export interface ClientTestExercise {
    id: string;                         // The exercise id.
    moduleId: string | null;            // The owning module id, or null for level-test exercises.
    type: string;                       // The exercise type.
    prompt: string;                     // The prompt shown to the user.
    promptTranslation: string | null;   // English context for the prompt, when required by the type.
    words: string[] | null;             // The scrambled tokens for sentence_reorder; null otherwise.
    choices: string[] | null;           // For multiple_choice: the full option set (answer + distractors), deterministically ordered. null otherwise.
    vocabularyItemId: string | null;    // Linked vocabulary item id, if any.
    grammarConceptId: string | null;    // Linked grammar concept id, if any.
    timesShown: number;                 // How many times this exercise has been shown.
}

/**
 * Maps an Exercise to its client-facing form for an in-progress test, where the correct answer must not be exposed.
 *
 * Business rules:
 * - Removes answer, alternativeAnswers and userContributedAnswers so the client cannot see the correct answer.
 * - For multiple_choice, exposes `choices` = the correct answer plus its distractors, sorted alphabetically so the
 *   option set is stable across start and resume and the answer's position is not revealed. `distractors` is deliberately
 *   not returned for multiple_choice, otherwise the answer could be recovered as (choices minus distractors).
 *
 * @param {Exercise} exercise - The full exercise (including the correct answer).
 *
 * @returns {ClientTestExercise} The exercise without the correct answer, with `choices` populated for multiple_choice.
 */
export function toClientTestExercise(exercise: Exercise): ClientTestExercise {

    const choices = exercise.type === "multiple_choice" ? [exercise.answer, ...(exercise.distractors ?? [])].sort((a, b) => a.localeCompare(b)) : null;

    return {
        id: exercise.id,
        moduleId: exercise.moduleId,
        type: exercise.type,
        prompt: exercise.prompt,
        promptTranslation: exercise.promptTranslation,
        words: exercise.words,
        choices,
        vocabularyItemId: exercise.vocabularyItemId,
        grammarConceptId: exercise.grammarConceptId,
        timesShown: exercise.timesShown,
    };
}
