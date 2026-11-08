import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig, WORDS_PRACTICE_MASTERY_WEIGHT, WORDS_PRACTICE_SESSION_SIZE, WORDS_PRACTICE_STALENESS_HORIZON_DAYS, WORDS_PRACTICE_STALENESS_WEIGHT } from "../../Config";
import { WordsPracticeSession, WordsPracticeWord } from "../../model/WordsPracticeSession";
import { ModuleStore } from "../../store/ModuleStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";
import { WordsPoolLoader } from "../../util/WordsPoolLoader";
import { drawWords, WordGroup } from "../../util/WordsPracticePool";

class OpenSessionError extends ValidationError {

    sessionId: string;      // The open session the client should resume.

    constructor(sessionId: string) {
        super(409, "A Words Practice session is already in progress");
        this.sessionId = sessionId;
    }
}

class EmptyPoolError extends ValidationError {

    reason: string;         // Machine-readable cause: "emptyPool".

    constructor() {
        super(400, "No words to practice: complete a module first");
        this.reason = "emptyPool";
    }
}

export class PostWordsPracticeSession extends TotoDelegate<PostWordsPracticeSessionRequest, WordsPracticeSession> {

    /**
     * Extracts the userId route parameter.
     */
    parseRequest(req: Request): PostWordsPracticeSessionRequest {

        const userId = req.params.userId;

        if (!userId) throw new ValidationError(400, "userId is required");

        return { userId };
    }

    /**
     * Starts a Words Practice session: builds the user's word pool, draws up to
     * WORDS_PRACTICE_SESSION_SIZE practice words (weighted towards low mastery and staleness)
     * and persists the session.
     *
     * - 409 (with `sessionId`) when the user already has an in_progress session.
     * - 400 `emptyPool` when the pool is empty.
     */
    async do(req: PostWordsPracticeSessionRequest, userContext?: UserContext): Promise<WordsPracticeSession> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const userId = req.userId;

        const sessionStore = new WordsPracticeSessionStore({ db, config });

        const open = await sessionStore.findInProgressByUser(userId);

        if (open) throw new OpenSessionError(open.id!);

        const loader = new WordsPoolLoader({
            moduleProgressStore: new UserModuleProgressStore({ db, config }),
            moduleStore: new ModuleStore(db),
            vocabularyStore: new VocabularyItemStore(db),
            vocabularyProgressStore: new UserVocabularyProgressStore({ db, config }),
        });

        const pool = await loader.load(userId);

        if (pool.length === 0) throw new EmptyPoolError();

        const drawn = drawWords({
            groups: pool,
            size: WORDS_PRACTICE_SESSION_SIZE,
            masteryWeight: WORDS_PRACTICE_MASTERY_WEIGHT,
            stalenessWeight: WORDS_PRACTICE_STALENESS_WEIGHT,
            stalenessHorizonDays: WORDS_PRACTICE_STALENESS_HORIZON_DAYS,
            now: new Date(),
        });

        const session = new WordsPracticeSession({
            userId,
            status: "in_progress",
            startedAt: new Date().toISOString(),
            completedAt: null,
            words: drawn.map(toPracticeWord),
            lastAnsweredWordKey: null,
        });

        session.id = await sessionStore.create(session);

        return session;
    }
}

/**
 * Snapshots a drawn word group into a fresh, unanswered session word.
 */
function toPracticeWord(group: WordGroup): WordsPracticeWord {

    return new WordsPracticeWord({
        wordKey: group.wordKey,
        vocabularyItemIds: group.items.map(i => i.id),
        promptItemId: group.promptItem.id,
        english: group.promptItem.english,
        type: group.promptItem.type,
        context: group.promptItem.context,
        danish: group.promptItem.danish,
        attempts: [],
        firstAttemptCorrect: null,
        correct: false,
        firstAttemptResultApplied: false,
    });
}

interface PostWordsPracticeSessionRequest {
    userId: string;     // The user starting the session.
}
