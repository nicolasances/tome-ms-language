import { Exercise } from "../model/Exercise";

export interface CheckAnswerResult {
    isCorrect: boolean;
    correctAnswer: string;
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
 * Checks whether a user's answer is correct for a given exercise.
 *
 * Compares the normalized userAnswer against the exercise's canonical answer,
 * alternativeAnswers, and userContributedAnswers. Returns the canonical answer
 * as correctAnswer regardless of which variant matched, so the caller always
 * knows what the intended answer is.
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

    const isCorrect = allAccepted.includes(normalized);

    return { isCorrect, correctAnswer: exercise.answer };
}
