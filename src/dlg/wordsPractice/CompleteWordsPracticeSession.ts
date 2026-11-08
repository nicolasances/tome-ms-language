import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { WordsPracticeSession } from "../../model/WordsPracticeSession";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";
import { WordsPracticeMastery } from "../../util/WordsPracticeMastery";

/**
 * Raised when `/complete` is called while the session still holds words that have not been
 * answered correctly — the retry loop has not been driven to the end. Carries the outstanding
 * word keys so the client can resume exactly those.
 */
class OutstandingWordsError extends ValidationError {

    outstandingWordKeys: string[];      // The words that are not yet correct.

    constructor(outstandingWordKeys: string[]) {
        super(400, `Session cannot be completed: ${outstandingWordKeys.length} word(s) have not been answered correctly yet`);
        this.outstandingWordKeys = outstandingWordKeys;
    }
}

export class CompleteWordsPracticeSession extends TotoDelegate<CompleteWordsPracticeSessionRequest, WordsPracticeSession> {

    /**
     * Extracts userId and sessionId from the route parameters.
     */
    parseRequest(req: Request): CompleteWordsPracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    /**
     * Closes the session: status → completed, completedAt = now.
     *
     * - 400 with `outstandingWordKeys` while any word is not yet correct. The refusal is atomic:
     *   nothing is written.
     * - A pending wrong first attempt is finalized (written as incorrect, once) before closing.
     * - Idempotent: an already-completed session is returned unchanged.
     */
    async do(req: CompleteWordsPracticeSessionRequest, userContext?: UserContext): Promise<WordsPracticeSession> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new WordsPracticeSessionStore({ db, config });
        const mastery = new WordsPracticeMastery({ vocabularyProgressStore: new UserVocabularyProgressStore({ db, config }) });

        const session = await sessionStore.findById(req.sessionId);

        if (!session || session.userId !== req.userId) throw new ValidationError(404, `Words practice session ${req.sessionId} not found`);

        if (session.status === "completed") return session;

        const outstanding = session.words.filter(w => !w.correct).map(w => w.wordKey);

        if (outstanding.length > 0) throw new OutstandingWordsError(outstanding);

        const now = new Date().toISOString();

        await mastery.flushPending({ session, timestamp: now });

        session.status = "completed";
        session.completedAt = now;

        await sessionStore.save(session);

        return session;
    }
}

interface CompleteWordsPracticeSessionRequest {
    userId: string;     // The user closing the session.
    sessionId: string;  // The session to close.
}
