import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { VertexAIClient } from "../../ai/VertexAIClient";
import { COMMON_JUDGING_RULES, generateOptionalNote, resolveVerificationClient } from "../../ai/AnswerVerification";
import { WordsPracticeWord } from "../../model/WordsPracticeSession";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";
import { WordsPracticeSessionStore } from "../../store/WordsPracticeSessionStore";
import { WordsPracticeMastery } from "../../util/WordsPracticeMastery";

export class VerifyWordsPracticeAnswer extends TotoDelegate<VerifyWordsPracticeAnswerRequest, VerifyWordsPracticeAnswerResponse> {

    /** Injectable AI client. If null, lazily initialised from env vars on first call. */
    aiClient: VertexAIClient | null = null;

    /**
     * Extracts the route params and the body (`wordKey`, `cefrLevel`).
     */
    parseRequest(req: Request): VerifyWordsPracticeAnswerRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;
        const wordKey = req.body?.wordKey;
        const cefrLevel = req.body?.cefrLevel;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");
        if (!wordKey) throw new ValidationError(400, "wordKey is required");
        if (!cefrLevel) throw new ValidationError(400, "cefrLevel is required");

        return { userId, sessionId, wordKey, cefrLevel };
    }

    /**
     * Asks the AI whether the user's most recent (wrong) answer is a valid Danish translation of the prompt (F27).
     *
     * - Only the session's most recent answer, only when wrong, only once (`aiChecked`).
     * - The user answer is read from the stored attempt; the verdict prompt never contains the canonical Danish.
     * - Valid: the attempt and word become correct; on a first attempt the pending mastery write is made as correct.
     * - Invalid: the explanation is returned; on a first attempt the pending mastery write is made as incorrect.
     * - AI failure: the error propagates and nothing is changed, so the check can be retried.
     * - Nothing is written to vocabulary items or exercises.
     */
    async do(req: VerifyWordsPracticeAnswerRequest, _userContext?: UserContext): Promise<VerifyWordsPracticeAnswerResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new WordsPracticeSessionStore({ db, config });
        const mastery = new WordsPracticeMastery({ vocabularyProgressStore: new UserVocabularyProgressStore({ db, config }) });

        const session = await sessionStore.findById(req.sessionId);

        if (!session || session.userId !== req.userId) throw new ValidationError(404, `Words practice session ${req.sessionId} not found`);
        if (session.status === "completed") throw new ValidationError(400, "Session is already completed");
        if (session.lastAnsweredWordKey !== req.wordKey) throw new ValidationError(400, `Word ${req.wordKey} is not the most recent answer of this session`);

        const word = session.words.find(w => w.wordKey === req.wordKey);

        if (!word || word.attempts.length === 0) throw new ValidationError(400, `Word ${req.wordKey} has no answer to verify`);

        const attempt = word.attempts[word.attempts.length - 1];

        if (attempt.isCorrect) throw new ValidationError(400, "The most recent answer is already correct");
        if (attempt.aiChecked) throw new ValidationError(409, "This answer has already been checked with AI");

        const client = this.aiClient = resolveVerificationClient(this.aiClient);

        const raw = await client.generate(buildVerdictPrompt({ word, userAnswer: attempt.userAnswer, cefrLevel: req.cefrLevel }));
        const verdict = JSON.parse(raw) as AIVerdictResponse;

        const now = new Date().toISOString();
        const valid = !!verdict.valid;

        attempt.aiChecked = true;

        if (valid) {
            attempt.isCorrect = true;
            word.correct = true;
        }

        if (attempt.isFirstAttempt) {
            word.firstAttemptCorrect = valid;
            await mastery.writeFirstAttempt({ userId: session.userId, word, isCorrect: valid, userAnswer: attempt.userAnswer, timestamp: now });
        }

        await sessionStore.save(session);

        if (!valid) return { valid: false, explanation: verdict.explanation };

        const note = await generateOptionalNote(client, buildNotePrompt({ word, userAnswer: attempt.userAnswer, cefrLevel: req.cefrLevel }));

        return note ? { valid: true, explanation: note } : { valid: true };
    }
}

/**
 * Builds the verdict prompt. It deliberately contains only the English prompt (with type and context), the
 * user's answer and the CEFR level: never the canonical Danish, so the answer is judged against real Danish.
 */
function buildVerdictPrompt({ word, userAnswer, cefrLevel }: { word: WordsPracticeWord; userAnswer: string; cefrLevel: string }): string {

    const contextLine = word.context ? `\n            Context: "${word.context}"` : "";

    return `You are a Danish language tutor. A student was asked to translate an English word or phrase into Danish and you give an independent opinion on their answer.

            English word/phrase: "${word.english}"
            Type: ${word.type}${contextLine}
            Student's Danish answer: "${userAnswer}"
            Student's CEFR level: ${cefrLevel}

            Consider: is this a correct Danish translation of the English word/phrase, would a Danish speaker understand it, and is it a proper way to express this in everyday Danish?

            The answer is NOT valid only if it is wrong Danish, changes the meaning, sounds really odd to a native speaker, or is inappropriate.
            A different but correct word (a synonym) is valid. There is no single expected answer: do not mark it wrong because other words exist.

            Other considerations to keep in mind:
            ${COMMON_JUDGING_RULES}
            - A bare noun without en/et, or an infinitive with or without "at", is not a reason to reject.

            Return a JSON object with exactly these fields, in this order:
            - reasoning: string — a brief analysis of the answer: correctness, meaning and naturalness
            - valid: boolean — true if the answer is valid, false otherwise. It must follow from your reasoning.
            - explanation: string (only when valid is false) — a brief explanation in English of why the answer is not valid Danish for the prompt, tailored to CEFR level ${cefrLevel}
    `;
}

/**
 * Builds the note prompt, used only after the answer was judged valid. This step sees the canonical Danish.
 */
function buildNotePrompt({ word, userAnswer, cefrLevel }: NoteInput): string {

    return `You are a Danish language tutor. A student's Danish answer has already been judged correct. Do not question that.

            English word/phrase: "${word.english}"
            Student's Danish answer: "${userAnswer}"
            Form used in the student's module: "${word.danish}"
            Student's CEFR level: ${cefrLevel}

            If the student's answer is the same as the form used in the module (ignoring case and punctuation), there is nothing to add.
            Otherwise, write a short, friendly note in English, tailored to CEFR level ${cefrLevel}, saying the answer is correct and pointing at the form used in the module. For example: "Correct — the form used in your module was stor".

            Return a JSON object with exactly this field:
            - explanation: string (only when there is something to add) — the note
    `;
}

interface NoteInput {
    word: WordsPracticeWord;    // The practice word (carries the canonical Danish)
    userAnswer: string;         // The student's answer
    cefrLevel: string;          // The student's CEFR level
}

interface AIVerdictResponse {
    reasoning: string;          // The AI's analysis, produced before the verdict
    valid: boolean;             // Whether the answer is acceptable
    explanation?: string;       // Present only when valid is false
}

interface VerifyWordsPracticeAnswerRequest {
    userId: string;         // The user owning the session.
    sessionId: string;      // The session being checked.
    wordKey: string;        // The practice word whose most recent answer is checked.
    cefrLevel: string;      // The user's CEFR level (e.g. "A1").
}

interface VerifyWordsPracticeAnswerResponse {
    valid: boolean;             // Whether the AI accepted the answer.
    explanation?: string;       // Always present when valid is false; optional note when valid is true.
}
