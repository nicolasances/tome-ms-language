import { WithId } from "mongodb";

export const WORDS_PRACTICE_STATUSES = ["in_progress", "completed"] as const;
export type WordsPracticeStatus = typeof WORDS_PRACTICE_STATUSES[number];

export class WordsPracticeAttempt {

    userAnswer: string;         // The raw answer submitted by the user.
    isCorrect: boolean;         // Whether the answer was judged correct.
    isFirstAttempt: boolean;    // True for the first answer to the word in this session; later answers are retries.
    aiChecked: boolean;         // Whether the attempt's outcome came from the AI check (F27).
    timestamp: string;          // ISO-8601 time the answer was submitted.

    constructor({ userAnswer, isCorrect, isFirstAttempt, aiChecked, timestamp }: WordsPracticeAttemptInput) {
        this.userAnswer = userAnswer;
        this.isCorrect = isCorrect;
        this.isFirstAttempt = isFirstAttempt;
        this.aiChecked = aiChecked;
        this.timestamp = timestamp;
    }

    static fromBSON(data: any): WordsPracticeAttempt {
        return new WordsPracticeAttempt({
            userAnswer: data.userAnswer,
            isCorrect: data.isCorrect,
            isFirstAttempt: data.isFirstAttempt,
            aiChecked: data.aiChecked ?? false,
            timestamp: data.timestamp,
        });
    }

    toBSON(): any {
        return { userAnswer: this.userAnswer, isCorrect: this.isCorrect, isFirstAttempt: this.isFirstAttempt, aiChecked: this.aiChecked, timestamp: this.timestamp };
    }
}

export class WordsPracticeWord {

    wordKey: string;                        // Normalized Danish form; the dedup key and the word's identifier within the session.
    vocabularyItemIds: string[];            // Every vocabulary item in the group; all receive the mastery write.
    promptItemId: string;                   // The representative item the prompt was taken from.
    english: string;                        // Snapshot of the prompt (English side).
    type: string;                           // Snapshot of the prompt item's vocabulary type.
    context: string | null;                 // Snapshot of the prompt item's context.
    danish: string;                         // Snapshot of the canonical Danish answer.
    attempts: WordsPracticeAttempt[];       // Every answer given to this word, oldest first.
    firstAttemptCorrect: boolean | null;    // Outcome of the first attempt; null until answered.
    correct: boolean;                       // True once answered correctly (or accepted by F27).
    firstAttemptResultApplied: boolean;     // Whether the first-attempt mastery write has been made (false while pending).

    constructor({ wordKey, vocabularyItemIds, promptItemId, english, type, context, danish, attempts, firstAttemptCorrect, correct, firstAttemptResultApplied }: WordsPracticeWordInput) {
        this.wordKey = wordKey;
        this.vocabularyItemIds = vocabularyItemIds;
        this.promptItemId = promptItemId;
        this.english = english;
        this.type = type;
        this.context = context;
        this.danish = danish;
        this.attempts = attempts;
        this.firstAttemptCorrect = firstAttemptCorrect;
        this.correct = correct;
        this.firstAttemptResultApplied = firstAttemptResultApplied;
    }

    static fromBSON(data: any): WordsPracticeWord {
        return new WordsPracticeWord({
            wordKey: data.wordKey,
            vocabularyItemIds: data.vocabularyItemIds ?? [],
            promptItemId: data.promptItemId,
            english: data.english,
            type: data.type,
            context: data.context ?? null,
            danish: data.danish,
            attempts: (data.attempts ?? []).map((a: any) => WordsPracticeAttempt.fromBSON(a)),
            firstAttemptCorrect: data.firstAttemptCorrect ?? null,
            correct: data.correct ?? false,
            firstAttemptResultApplied: data.firstAttemptResultApplied ?? false,
        });
    }

    toBSON(): any {
        return {
            wordKey: this.wordKey,
            vocabularyItemIds: this.vocabularyItemIds,
            promptItemId: this.promptItemId,
            english: this.english,
            type: this.type,
            context: this.context,
            danish: this.danish,
            attempts: this.attempts.map(a => a.toBSON()),
            firstAttemptCorrect: this.firstAttemptCorrect,
            correct: this.correct,
            firstAttemptResultApplied: this.firstAttemptResultApplied,
        };
    }
}

export class WordsPracticeSession {

    id?: string;                            // MongoDB _id as a hex string; absent before first save.
    userId: string;                         // The user who owns the session.
    status: WordsPracticeStatus;            // Lifecycle: in_progress until completed.
    startedAt: string;                      // ISO-8601 creation time.
    completedAt: string | null;             // ISO-8601 completion time; null while in progress. Read by F24.
    words: WordsPracticeWord[];             // The practice words, fixed at start, in presentation order.
    lastAnsweredWordKey: string | null;     // The word of the most recent answer (the only one F27 may check).

    constructor({ id, userId, status, startedAt, completedAt, words, lastAnsweredWordKey }: WordsPracticeSessionInput) {
        this.id = id;
        this.userId = userId;
        this.status = status;
        this.startedAt = startedAt;
        this.completedAt = completedAt ?? null;
        this.words = words ?? [];
        this.lastAnsweredWordKey = lastAnsweredWordKey ?? null;
    }

    static fromBSON(data: WithId<any>): WordsPracticeSession {
        return new WordsPracticeSession({
            id: data._id.toString(),
            userId: data.userId,
            status: data.status,
            startedAt: data.startedAt,
            completedAt: data.completedAt ?? null,
            words: (data.words ?? []).map((w: any) => WordsPracticeWord.fromBSON(w)),
            lastAnsweredWordKey: data.lastAnsweredWordKey ?? null,
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            status: this.status,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            words: this.words.map(w => w.toBSON()),
            lastAnsweredWordKey: this.lastAnsweredWordKey,
        };
    }
}

interface WordsPracticeAttemptInput {
    userAnswer: string;
    isCorrect: boolean;
    isFirstAttempt: boolean;
    aiChecked: boolean;
    timestamp: string;
}

interface WordsPracticeWordInput {
    wordKey: string;
    vocabularyItemIds: string[];
    promptItemId: string;
    english: string;
    type: string;
    context: string | null;
    danish: string;
    attempts: WordsPracticeAttempt[];
    firstAttemptCorrect: boolean | null;
    correct: boolean;
    firstAttemptResultApplied: boolean;
}

interface WordsPracticeSessionInput {
    id?: string;
    userId: string;
    status: WordsPracticeStatus;
    startedAt: string;
    completedAt?: string | null;
    words?: WordsPracticeWord[];
    lastAnsweredWordKey?: string | null;
}
