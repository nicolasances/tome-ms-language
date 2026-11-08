import { ExerciseResult } from "../model/ExerciseResult";
import { WordsPracticeSession, WordsPracticeWord } from "../model/WordsPracticeSession";
import { UserVocabularyProgressStore } from "../store/UserVocabularyProgressStore";

export interface WordsPracticeMasteryInput {
    vocabularyProgressStore: UserVocabularyProgressStore;   // Where the mastery results are written.
}

export interface WriteFirstAttemptInput {
    userId: string;             // The user whose mastery is updated.
    word: WordsPracticeWord;    // The word; its firstAttemptResultApplied flag is set to true.
    isCorrect: boolean;         // The final outcome of the word's first attempt.
    userAnswer: string;         // The first attempt's answer.
    timestamp: string;          // ISO-8601 time stamped on the result (and on lastReviewed).
}

export interface FlushPendingInput {
    session: WordsPracticeSession;  // The session whose pending first attempt (if any) is finalized.
    timestamp: string;              // ISO-8601 time stamped on the result.
}

/**
 * Writes Words Practice results into mastery (F06) following the F26 rules: only first attempts
 * count, a correct one immediately, a wrong one only once it can no longer be overturned.
 */
export class WordsPracticeMastery {

    private vocabularyProgressStore: UserVocabularyProgressStore;

    constructor({ vocabularyProgressStore }: WordsPracticeMasteryInput) {
        this.vocabularyProgressStore = vocabularyProgressStore;
    }

    /**
     * Writes the final outcome of a word's first attempt to every vocabulary item in the word's
     * group, as one `words_practice` result, and marks the word as applied.
     *
     * @param {WriteFirstAttemptInput} input - The word, its outcome and the first attempt's answer.
     */
    async writeFirstAttempt(input: WriteFirstAttemptInput): Promise<void> {

        const { userId, word, isCorrect, userAnswer, timestamp } = input;

        const result = new ExerciseResult({ exerciseId: null, type: "words_practice", isCorrect, userAnswer, correctAnswer: word.danish, timestamp, moduleId: null });

        await this.vocabularyProgressStore.appendResultToItems(userId, word.vocabularyItemIds, result);

        word.firstAttemptResultApplied = true;
    }

    /**
     * Finalizes the session's pending result, if any: a wrong first attempt whose mastery write
     * was deferred. Called when a further answer arrives and when the session completes. The
     * pending result is written as incorrect, exactly once.
     *
     * @param {FlushPendingInput} input - The session and the time to stamp.
     *
     * @returns {Promise<boolean>} True when a pending result was written (the session changed).
     */
    async flushPending(input: FlushPendingInput): Promise<boolean> {

        const pending = input.session.words.find(w => w.firstAttemptCorrect === false && !w.firstAttemptResultApplied);

        if (!pending) return false;

        await this.writeFirstAttempt({ userId: input.session.userId, word: pending, isCorrect: false, userAnswer: pending.attempts[0].userAnswer, timestamp: input.timestamp });

        return true;
    }
}
