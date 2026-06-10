import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseStore } from "../../store/ExerciseStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";
import { GrammarConceptStore } from "../../store/GrammarConceptStore";
import { VertexAIClient, buildVertexAIClient } from "../../ai/VertexAIClient";

export class PostExerciseMistakeExplanation extends TotoDelegate<PostExerciseMistakeExplanationRequest, PostExerciseMistakeExplanationResponse> {

    /** Injectable AI client. If null, lazily initialised from env vars on first call. */
    aiClient: VertexAIClient | null = null;

    parseRequest(req: Request): PostExerciseMistakeExplanationRequest {

        const exerciseId = req.params.exerciseId;
        const userAnswer = req.body?.userAnswer;
        const cefrLevel = req.body?.cefrLevel;

        if (!exerciseId) throw new ValidationError(400, "exerciseId is required");
        if (userAnswer === undefined || userAnswer === null) throw new ValidationError(400, "userAnswer is required");
        if (!cefrLevel) throw new ValidationError(400, "cefrLevel is required");

        return { exerciseId, userAnswer: String(userAnswer), cefrLevel };
    }

    /**
     * Fetches the exercise and its linked vocabulary item or grammar concept,
     * builds a CEFR-aware prompt, calls Vertex AI, and returns the structured explanation.
     *
     * @param {PostExerciseMistakeExplanationRequest} req - The parsed request.
     * @param {UserContext} _userContext - The authenticated user context (unused).
     *
     * @returns {PostExerciseMistakeExplanationResponse} The four-field explanation object.
     */
    async do(req: PostExerciseMistakeExplanationRequest, _userContext?: UserContext): Promise<PostExerciseMistakeExplanationResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const exercise = await new ExerciseStore(db).findById(req.exerciseId);

        if (!exercise) throw new ValidationError(404, `Exercise not found for id '${req.exerciseId}'`);

        let vocabOrGrammarBlock: string;

        if (exercise.vocabularyItemId) {

            const vocab = await new VocabularyItemStore(db).findById(exercise.vocabularyItemId);

            if (!vocab) throw new ValidationError(404, `Vocabulary item not found for id '${exercise.vocabularyItemId}'`);

            vocabOrGrammarBlock = `Linked vocabulary item: "${vocab.danish}" (${vocab.english}) — ${vocab.context ?? vocab.type}`;

        } else if (exercise.grammarConceptId) {

            const concept = await new GrammarConceptStore(db).findById(exercise.grammarConceptId);

            if (!concept) throw new ValidationError(404, `Grammar concept not found for id '${exercise.grammarConceptId}'`);

            vocabOrGrammarBlock = `Linked grammar concept: "${concept.name}" — ${concept.explanation}`;

        } else {

            throw new ValidationError(404, `Exercise '${req.exerciseId}' has no linked vocabulary item or grammar concept`);

        }

        const prompt = buildPrompt({ exercise, userAnswer: req.userAnswer, cefrLevel: req.cefrLevel, vocabOrGrammarBlock });

        const client = this.aiClient ?? (this.aiClient = buildVertexAIClient());

        const raw = await client.generate(prompt);

        const parsed = JSON.parse(raw) as PostExerciseMistakeExplanationResponse;

        return {
            correctAnswer: parsed.correctAnswer,
            explanation: parsed.explanation,
            rule: parsed.rule,
            example: parsed.example,
        };
    }
}

/**
 * Builds the CEFR-aware prompt for the mistake explanation request.
 *
 * @param {PromptInput} input - Exercise, user answer, CEFR level, and the linked-item block.
 *
 * @returns {string} The fully-formed prompt string.
 */
function buildPrompt({ exercise, userAnswer, cefrLevel, vocabOrGrammarBlock }: PromptInput): string {

    return `You are a Danish language tutor. A student at CEFR level ${cefrLevel} answered an exercise incorrectly.

Exercise prompt: "${exercise.prompt}"
Correct answer: "${exercise.answer}"
Student's answer: "${userAnswer}"

${vocabOrGrammarBlock}

Return a JSON object with exactly these fields:
- correctAnswer: the correct answer as a string
- explanation: why the correct answer is right, tailored to CEFR level ${cefrLevel}
- rule: the underlying grammar or vocabulary rule, stated simply in English
- example: a second Danish sentence demonstrating the same rule (different from the exercise prompt)`;
}

interface PromptInput {
    exercise: { prompt: string; answer: string };    // The exercise data used in the prompt
    userAnswer: string;                              // The student's incorrect answer
    cefrLevel: string;                               // The student's CEFR level
    vocabOrGrammarBlock: string;                     // The linked item description line
}

interface PostExerciseMistakeExplanationRequest {
    exerciseId: string;     // The id of the exercise the student answered incorrectly
    userAnswer: string;     // The student's incorrect answer
    cefrLevel: string;      // The student's CEFR level (e.g. "A1", "B2")
}

interface PostExerciseMistakeExplanationResponse {
    correctAnswer: string;  // The correct answer to the exercise
    explanation: string;    // Why the correct answer is right, tailored to the CEFR level
    rule: string;           // The underlying grammar or vocabulary rule, in plain English
    example: string;        // A second Danish sentence demonstrating the same rule
}
