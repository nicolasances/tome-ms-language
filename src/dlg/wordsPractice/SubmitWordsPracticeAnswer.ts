import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { WordsPracticeAttempt } from "../../model/WordsPracticeSession";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";
import { checkWordAnswer } from "../../util/WordAnswerChecker";
import { WordsPracticeMastery } from "../../util/WordsPracticeMastery";

export class SubmitWordsPracticeAnswer extends TotoDelegate<SubmitWordsPracticeAnswerRequest, SubmitWordsPracticeAnswerResponse> {

    /**
     * Extracts the route params and the body (`wordKey`, `userAnswer`).
     */
    parseRequest(req: Request): SubmitWordsPracticeAnswerRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;
        const wordKey = req.body?.wordKey;
        const userAnswer = req.body?.userAnswer;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");
        if (!wordKey) throw new ValidationError(400, "wordKey is required");
        if (userAnswer === undefined || userAnswer === null) throw new ValidationError(400, "userAnswer is required");

        return { userId, sessionId, wordKey, userAnswer: String(userAnswer) };
    }

    /**
     * Judges and records one answer.
     *
     * Mastery rules (first attempts only):
     * - a pending wrong first attempt (from an earlier answer) is finalized as incorrect first,
     *   because any further answer ends the window in which the AI check (F27) may overturn it;
     * - a correct first attempt is written to every item of the word's group immediately;
     * - a wrong first attempt stays pending; retries never touch mastery.
     */
    async do(req: SubmitWordsPracticeAnswerRequest, userContext?: UserContext): Promise<SubmitWordsPracticeAnswerResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new WordsPracticeSessionStore({ db, config });
        const mastery = new WordsPracticeMastery({ vocabularyProgressStore: new UserVocabularyProgressStore({ db, config }) });

        const session = await sessionStore.findById(req.sessionId);

        if (!session || session.userId !== req.userId) throw new ValidationError(404, `Words practice session ${req.sessionId} not found`);
        if (session.status === "completed") throw new ValidationError(400, "Session is already completed");

        const word = session.words.find(w => w.wordKey === req.wordKey);

        if (!word) throw new ValidationError(400, `Word ${req.wordKey} is not part of this session`);
        if (word.correct) throw new ValidationError(400, `Word ${req.wordKey} has already been answered correctly`);

        const now = new Date().toISOString();

        await mastery.flushPending({ session, timestamp: now });

        const isCorrect = checkWordAnswer({ userAnswer: req.userAnswer, canonical: word.danish });
        const isFirstAttempt = word.attempts.length === 0;

        word.attempts.push(new WordsPracticeAttempt({ userAnswer: req.userAnswer, isCorrect, isFirstAttempt, aiChecked: false, timestamp: now }));
        session.lastAnsweredWordKey = word.wordKey;

        if (isCorrect) word.correct = true;

        if (isFirstAttempt) {
            word.firstAttemptCorrect = isCorrect;

            if (isCorrect) await mastery.writeFirstAttempt({ userId: session.userId, word, isCorrect: true, userAnswer: req.userAnswer, timestamp: now });
        }

        await sessionStore.save(session);

        return { isCorrect, correctAnswer: word.danish, isFirstAttempt };
    }
}

interface SubmitWordsPracticeAnswerRequest {
    userId: string;         // The user answering.
    sessionId: string;      // The session being answered.
    wordKey: string;        // The practice word being answered.
    userAnswer: string;     // The raw typed answer.
}

interface SubmitWordsPracticeAnswerResponse {
    isCorrect: boolean;         // Whether the answer was judged correct.
    correctAnswer: string;      // The canonical Danish answer.
    isFirstAttempt: boolean;    // True when this was the word's first answer in the session.
}
