import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";
import { VertexAIClient, buildVertexAIClient } from "../../ai/VertexAIClient";

export class PostExerciseAnswerVerification extends TotoDelegate<PostExerciseAnswerVerificationRequest, PostExerciseAnswerVerificationResponse> {

    /** Injectable AI client. If null, lazily initialised from env vars on first call. */
    aiClient: VertexAIClient | null = null;

    /**
     * Extracts and validates the request parameters and body.
     *
     * @param {Request} req - The Express request object.
     *
     * @returns {PostExerciseAnswerVerificationRequest} The validated request.
     */
    parseRequest(req: Request): PostExerciseAnswerVerificationRequest {

        const exerciseId = req.params.exerciseId;
        const userAnswer = req.body?.userAnswer;
        const sessionId = req.body?.sessionId;
        const cefrLevel = req.body?.cefrLevel;

        if (!exerciseId) throw new ValidationError(400, "exerciseId is required");
        if (userAnswer === undefined || userAnswer === null) throw new ValidationError(400, "userAnswer is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");
        if (!cefrLevel) throw new ValidationError(400, "cefrLevel is required");

        return { exerciseId, userAnswer: String(userAnswer), sessionId, cefrLevel };
    }

    /**
     * Verifies whether a user's translation (marked wrong by the normalised matcher) is actually valid.
     *
     * Business rules:
     * - Only translation_active exercises are eligible.
     * - The container is resolved from a practice session (F10), a module test attempt (F11), or a
     *   level test attempt (F21) — sessionId is tried against PracticeSessionStore first, then
     *   ModuleTestAttemptStore, then LevelTestAttemptStore.
     * - Only one verification is allowed per (sessionId, exerciseId) pair.
     * - If the AI validates the answer: for a practice session, removes the exercise from the retry
     *   queue; for a module test or level test attempt, flips the stored answer's isCorrect flag
     *   (neither has a retry queue). In all cases, appends the answer to the exercise's
     *   userContributedAnswers and records the verification.
     * - If the AI rejects the answer: returns an explanation; no state is mutated.
     *
     * @param {PostExerciseAnswerVerificationRequest} req - The validated request.
     * @param {UserContext} _userContext - The authenticated user context (unused).
     *
     * @returns {PostExerciseAnswerVerificationResponse} The AI verdict and optional explanation.
     */
    async do(req: PostExerciseAnswerVerificationRequest, _userContext?: UserContext): Promise<PostExerciseAnswerVerificationResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const exerciseStore = new ExerciseStore(db);
        const sessionStore = new PracticeSessionStore({ db, config });
        const attemptStore = new ModuleTestAttemptStore({ db, config });
        const levelTestAttemptStore = new LevelTestAttemptStore({ db, config });

        const exercise = await exerciseStore.findById(req.exerciseId);

        if (!exercise) throw new ValidationError(404, `Exercise not found for id '${req.exerciseId}'`);

        if (exercise.type !== "translation_active") {
            throw new ValidationError(400, `Answer verification is only available for translation_active exercises; got '${exercise.type}'`);
        }

        const session = await sessionStore.findById(req.sessionId);
        const attempt = session ? null : await attemptStore.findById(req.sessionId);
        const levelTestAttempt = (session || attempt) ? null : await levelTestAttemptStore.findById(req.sessionId);

        if (!session && !attempt && !levelTestAttempt) throw new ValidationError(404, `Session/attempt not found for id '${req.sessionId}'`);

        const containerExerciseIds = session ? [...session.exerciseIds, ...session.retryQueue] : (attempt ?? levelTestAttempt)!.exerciseIds;
        const verifiedExerciseIds = session ? session.verifiedExerciseIds : (attempt ?? levelTestAttempt)!.verifiedExerciseIds;

        if (!containerExerciseIds.includes(req.exerciseId)) {
            throw new ValidationError(400, `Exercise '${req.exerciseId}' is not part of session/attempt '${req.sessionId}'`);
        }

        if (verifiedExerciseIds.includes(req.exerciseId)) {
            throw new ValidationError(409, `Answer verification was already used for exercise '${req.exerciseId}' in this session/attempt`);
        }

        const vocab = await new VocabularyItemStore(db).findById(exercise.vocabularyItemId!);

        if (!vocab) throw new ValidationError(404, `Vocabulary item not found for id '${exercise.vocabularyItemId}'`);

        const vocabContext = vocab.context ?? vocab.type;
        const prompt = buildPrompt({ exercise, userAnswer: req.userAnswer, cefrLevel: req.cefrLevel, vocabContext, vocabDanish: vocab.danish, vocabEnglish: vocab.english });

        const client = this.aiClient ?? (this.aiClient = buildVertexAIClient());

        const raw = await client.generate(prompt);

        const parsed = JSON.parse(raw) as AIVerificationResponse;

        if (parsed.valid) {

            if (session) {
                await sessionStore.removeFromRetryQueue(req.sessionId, req.exerciseId);
                await sessionStore.addVerifiedExerciseId(req.sessionId, req.exerciseId);
            } else if (attempt) {
                await attemptStore.flipAnswerToCorrect(req.sessionId, req.exerciseId);
                await attemptStore.addVerifiedExerciseId(req.sessionId, req.exerciseId);
            } else {
                await levelTestAttemptStore.flipAnswerToCorrect(req.sessionId, req.exerciseId);
                await levelTestAttemptStore.addVerifiedExerciseId(req.sessionId, req.exerciseId);
            }

            await exerciseStore.appendUserContributedAnswer(req.exerciseId, req.userAnswer);

            return { valid: true };
        }

        return { valid: false, explanation: parsed.explanation };
    }
}

/**
 * Builds the CEFR-aware prompt for the answer verification request.
 *
 * @param {PromptInput} input - Exercise data, user answer, CEFR level, and vocabulary context.
 *
 * @returns {string} The fully-formed prompt string.
 */
function buildPrompt({ exercise, userAnswer, cefrLevel, vocabContext, vocabDanish, vocabEnglish }: PromptInput): string {

    const allAccepted = [exercise.answer, ...exercise.alternativeAnswers].join('", "');

    return `You are a Danish language tutor verifying whether a student's translation is acceptable.

            Exercise prompt: "${exercise.prompt}"
            Accepted answers: ["${allAccepted}"]
            Student's answer: "${userAnswer}"

            Linked vocabulary item: "${vocabDanish}" (${vocabEnglish}) — ${vocabContext}
            Student's CEFR level: ${cefrLevel}

            Determine whether the student's answer is a valid translation of the exercise prompt.
            A minor spelling variation or a valid synonym is acceptable. An incorrect meaning or wrong grammar is not.
            
            Other considerations to keep in mind: 
            - Ignore case, always.
            - Ignore punctuation differences (periods, commas, quotation marks, dashes, etc.), always.
            - Be mindful of the broader context: the user is learning Danish and may use some other correct formulations, maybe not using the exact words in the prompt. That's ok, as long as the meaning is correct, the grammar is correct and this is a valid Danish sentence, that is valid in an everyday context.

            Return a JSON object with exactly these fields:
            - valid: boolean — true if the translation is acceptable, false otherwise
            - explanation: string (only when valid is false) — a brief explanation in English of why the translation is not valid, tailored to CEFR level ${cefrLevel}
    `;
}

interface PromptInput {
    exercise: { prompt: string; answer: string; alternativeAnswers: string[] };    // Exercise data for the prompt
    userAnswer: string;                                                             // The student's answer to verify
    cefrLevel: string;                                                              // The student's CEFR level
    vocabContext: string;                                                           // Context or type of the linked vocab item
    vocabDanish: string;                                                            // Danish form of the linked vocab item
    vocabEnglish: string;                                                           // English translation of the linked vocab item
}

interface AIVerificationResponse {
    valid: boolean;             // Whether the translation is acceptable
    explanation?: string;       // Present only when valid is false
}

interface PostExerciseAnswerVerificationRequest {
    exerciseId: string;     // The id of the translation_active exercise being verified
    userAnswer: string;     // The translation the student submitted
    sessionId: string;      // The practice session, module test attempt, or level test attempt id (used for the one-per-attempt guard)
    cefrLevel: string;      // The student's CEFR level (e.g. "A1", "B2")
}

interface PostExerciseAnswerVerificationResponse {
    valid: boolean;             // Whether the AI accepted the translation
    explanation?: string;       // Present only when valid is false
}
