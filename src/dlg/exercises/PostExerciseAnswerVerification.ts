import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { ModuleTestAttemptStore } from "../../store/ModuleTestAttemptStore";
import { LevelTestAttemptStore } from "../../store/LevelTestAttemptStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";
import { VertexAIClient, buildVertexAIClient } from "../../ai/VertexAIClient";

/** Model for the answer check. Judging real-world Danish needs more than the smallest tier. Overridable with VERTEX_AI_VERIFICATION_MODEL. */
const VERIFICATION_MODEL = process.env.VERTEX_AI_VERIFICATION_MODEL ?? "gemini-3.8-flash";

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
     * - The verdict is decided on the English prompt, the student's answer and the CEFR level alone: the AI never sees the
     *   accepted answers or the linked vocabulary item, so a correct but different phrasing is accepted.
     * - If the AI validates the answer: for a practice session, removes the exercise from the retry
     *   queue; for a module test or level test attempt, flips the stored answer's isCorrect flag
     *   (neither has a retry queue). In all cases, appends the answer to the exercise's
     *   userContributedAnswers and records the verification.
     *   Then, as a separate step, the AI is shown the accepted answers and target vocabulary item to write an optional
     *   short note on how the answer differs. A failure of that step never affects the verdict.
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

        const client = this.aiClient ?? (this.aiClient = buildVertexAIClient(VERIFICATION_MODEL));

        const raw = await client.generate(buildVerdictPrompt({ exercisePrompt: exercise.prompt, userAnswer: req.userAnswer, cefrLevel: req.cefrLevel }));

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

            const note = await this.buildNote({ client, exercise, userAnswer: req.userAnswer, cefrLevel: req.cefrLevel, vocabDanish: vocab.danish, vocabEnglish: vocab.english, vocabContext: vocab.context ?? vocab.type });

            return note ? { valid: true, explanation: note } : { valid: true };
        }

        return { valid: false, explanation: parsed.explanation };
    }

    /**
     * Asks the AI for a short note on a valid answer that differs from the expected answer / target vocabulary item.
     * The note is a nicety: any failure (AI error, unparsable output) yields no note instead of failing the verification.
     *
     * @param {NoteInput} input - The AI client, the exercise data, the student's answer and the linked vocabulary item.
     *
     * @returns {Promise<string | undefined>} The note, or undefined if there is nothing to add.
     */
    private async buildNote(input: NoteInput): Promise<string | undefined> {

        try {

            const raw = await input.client.generate(buildNotePrompt(input));

            const parsed = JSON.parse(raw) as AINoteResponse;

            return parsed.explanation?.trim() || undefined;

        } catch (error) {

            console.error("Could not generate the note for a valid answer", error);

            return undefined;

        }
    }
}

/**
 * Builds the verdict prompt. It deliberately contains only the English prompt, the student's answer and the CEFR level:
 * no accepted answers and no linked vocabulary item, so the student is judged against real-world Danish and not
 * against the exercise's expected answer.
 *
 * @param {VerdictPromptInput} input - The exercise prompt, the student's answer and the CEFR level.
 *
 * @returns {string} The fully-formed prompt string.
 */
function buildVerdictPrompt({ exercisePrompt, userAnswer, cefrLevel }: VerdictPromptInput): string {

    return `You are a Danish language tutor. A student translated an English sentence into Danish and you give an independent opinion on their translation.

            English sentence: "${exercisePrompt}"
            Student's Danish translation: "${userAnswer}"
            Student's CEFR level: ${cefrLevel}

            Consider: is this translation correct, would a Danish speaker easily understand it, and is it a proper way to express this in everyday Danish?

            The translation is NOT valid only if it is grammatically or syntactically wrong, changes the meaning of the English sentence, sounds really odd to a native speaker, or is inappropriate.
            A different but correct phrasing is valid. There is no single expected translation: do not mark it wrong because other phrasings exist, or because it uses different words than you would have used.

            Other considerations to keep in mind:
            - Ignore case, always.
            - Ignore punctuation differences (periods, commas, quotation marks, dashes, etc.), always.

            Return a JSON object with exactly these fields, in this order:
            - reasoning: string — a brief analysis of the student's translation: grammar, meaning and naturalness
            - valid: boolean — true if the translation is valid, false otherwise. It must follow from your reasoning.
            - explanation: string (only when valid is false) — a brief explanation in English of why the translation is not valid, tailored to CEFR level ${cefrLevel}
    `;
}

/**
 * Builds the note prompt, used only after the answer has been judged valid. This is the only step that sees the
 * accepted answers and the target vocabulary item.
 *
 * @param {NoteInput} input - Exercise data, the student's answer, CEFR level and the linked vocabulary item.
 *
 * @returns {string} The fully-formed prompt string.
 */
function buildNotePrompt({ exercise, userAnswer, cefrLevel, vocabDanish, vocabEnglish, vocabContext }: NoteInput): string {

    const allAccepted = [exercise.answer, ...exercise.alternativeAnswers].join('", "');

    return `You are a Danish language tutor. A student's Danish translation has already been judged correct. Do not question that.

            English sentence: "${exercise.prompt}"
            Student's Danish translation: "${userAnswer}"
            Expected answers: ["${allAccepted}"]
            Target vocabulary item of this exercise: "${vocabDanish}" (${vocabEnglish}) — ${vocabContext}
            Student's CEFR level: ${cefrLevel}

            If the student's translation is the same as one of the expected answers (ignoring case and punctuation), there is nothing to add.
            Otherwise, write a short, friendly note in English, tailored to CEFR level ${cefrLevel}, that tells the student their answer is correct and shows the expected phrasing or the target vocabulary item as another common way to say it. For example: "Correct! 'vel' is another common way to say this: Du er vel enig med mig?"

            Return a JSON object with exactly this field:
            - explanation: string (only when there is something to add) — the note
    `;
}

interface VerdictPromptInput {
    exercisePrompt: string;                                                         // The English prompt of the exercise
    userAnswer: string;                                                             // The student's answer to verify
    cefrLevel: string;                                                              // The student's CEFR level
}

interface NoteInput {
    client: VertexAIClient;                                                         // The AI client to call
    exercise: { prompt: string; answer: string; alternativeAnswers: string[] };    // Exercise data for the prompt
    userAnswer: string;                                                             // The student's answer
    cefrLevel: string;                                                              // The student's CEFR level
    vocabContext: string;                                                           // Context or type of the linked vocab item
    vocabDanish: string;                                                            // Danish form of the linked vocab item
    vocabEnglish: string;                                                           // English translation of the linked vocab item
}

interface AINoteResponse {
    explanation?: string;       // Short note on how the valid answer differs from the expected one, if anything is worth saying
}

interface AIVerificationResponse {
    reasoning: string;          // The AI's analysis, produced before the verdict
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
    explanation?: string;       // Required when valid is false (why). Optional when valid is true (a note on how the answer differs from the expected one)
}
