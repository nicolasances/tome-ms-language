import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PostExerciseAnswerVerification } from "../../../src/dlg/exercises/PostExerciseAnswerVerification";
import { Exercise } from "../../../src/model/Exercise";
import { VocabularyItem } from "../../../src/model/VocabularyItem";
import { VertexAIClient } from "../../../src/ai/VertexAIClient";

const SESSION_ID = new ObjectId().toString();
const ATTEMPT_ID = new ObjectId().toString();
const LEVEL_TEST_ATTEMPT_ID = new ObjectId().toString();

function makeTranslationExercise(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "I eat",
        promptTranslation: null,
        answer: "jeg spiser",
        alternativeAnswers: ["jeg spiser mad"],
        userContributedAnswers: [],
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeNonTranslationExercise(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "multiple_choice",
        prompt: "Choose the correct form",
        promptTranslation: "Choose the correct form",
        answer: "spiser",
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeVocabBSON(): any {
    return new VocabularyItem({
        id: "vocab-1",
        danish: "spise",
        english: "to eat",
        type: "verb",
        context: "used for eating food",
        tags: [],
        cefrLevel: "A1",
        source: "curriculum",
        addedByUserId: null,
    }).toBSON();
}

function makeSessionBSON(overrides: any = {}): any {
    return {
        _id: new ObjectId(SESSION_ID),
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: ["ex-1"],
        verifiedExerciseIds: [],
        startedAt: "2026-06-10T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

function makeAttemptBSON(overrides: any = {}): any {
    return {
        _id: new ObjectId(ATTEMPT_ID),
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [{ exerciseId: "ex-1", isCorrect: false, userAnswer: "jeg ede", answeredAt: "2026-06-10T09:00:00.000Z" }],
        currentPosition: 1,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-10T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeLevelTestAttemptBSON(overrides: any = {}): any {
    return {
        _id: new ObjectId(LEVEL_TEST_ATTEMPT_ID),
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [{ exerciseId: "ex-1", isCorrect: false, userAnswer: "jeg ede", answeredAt: "2026-06-10T09:00:00.000Z" }],
        currentPosition: 1,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-10T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockAIClient(response: string): VertexAIClient {
    return { generate: async (_prompt: string) => response };
}

/**
 * Builds a mock config. Tracks all updateOne calls for assertion.
 * exerciseUpdates: calls on the exercises collection
 * sessionUpdates: calls on the practiceSessions collection
 * attemptUpdates: calls on the moduleTestAttempts collection
 * levelTestAttemptUpdates: calls on the levelTestAttempts collection
 */
function makeMockConfig(exerciseDoc: any, vocabDoc: any, sessionDoc: any, attemptDoc: any = null, levelTestAttemptDoc: any = null) {

    const exerciseUpdates: any[] = [];
    const sessionUpdates: any[] = [];
    const attemptUpdates: any[] = [];
    const levelTestAttemptUpdates: any[] = [];

    const collections: Record<string, any> = {
        exercises: {
            findOne: async () => exerciseDoc,
            updateOne: async (filter: any, update: any) => {
                exerciseUpdates.push({ filter, update });
                return { matchedCount: exerciseDoc ? 1 : 0 };
            },
        },
        vocabulary: {
            findOne: async () => vocabDoc,
        },
        practiceSessions: {
            findOne: async () => sessionDoc,
            updateOne: async (filter: any, update: any) => {
                sessionUpdates.push({ filter, update });
                return { matchedCount: sessionDoc ? 1 : 0 };
            },
        },
        moduleTestAttempts: {
            findOne: async () => attemptDoc,
            updateOne: async (filter: any, update: any) => {
                attemptUpdates.push({ filter, update });
                return { matchedCount: attemptDoc ? 1 : 0 };
            },
        },
        levelTestAttempts: {
            findOne: async () => levelTestAttemptDoc,
            updateOne: async (filter: any, update: any) => {
                levelTestAttemptUpdates.push({ filter, update });
                return { matchedCount: levelTestAttemptDoc ? 1 : 0 };
            },
        },
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        exerciseUpdates,
        sessionUpdates,
        attemptUpdates,
        levelTestAttemptUpdates,
    };
}

describe("PostExerciseAnswerVerification.do", () => {

    it("throws 404 when the exercise does not exist", async () => {

        const { config } = makeMockConfig(null, null, null);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-missing", userAnswer: "hej", sessionId: SESSION_ID, cefrLevel: "A1" });
            assert.fail("Expected 404");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the exercise type is not translation_active", async () => {

        const { config } = makeMockConfig(makeNonTranslationExercise("ex-mc"), makeVocabBSON(), makeSessionBSON());
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-mc", userAnswer: "spiser", sessionId: SESSION_ID, cefrLevel: "A1" });
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 404 when the session does not exist", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: SESSION_ID, cefrLevel: "A1" });
            assert.fail("Expected 404");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the exercise is not part of the session", async () => {

        const session = makeSessionBSON({ exerciseIds: ["ex-2"], retryQueue: [] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), session);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: SESSION_ID, cefrLevel: "A1" });
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 409 when verification was already used for this (sessionId, exerciseId) pair", async () => {

        const session = makeSessionBSON({ verifiedExerciseIds: ["ex-1"] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), session);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: SESSION_ID, cefrLevel: "A1" });
            assert.fail("Expected 409");
        } catch (err: any) {
            assert.equal(err.code, 409);
        }
    });

    it("returns { valid: true } and updates session + exercise when AI validates the translation", async () => {

        const { config, sessionUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            makeSessionBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: true }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spiser", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.isUndefined(result.explanation);

        const retryPull = sessionUpdates.find((u: any) => u.update.$pull?.retryQueue === "ex-1");
        assert.isDefined(retryPull, "expected retryQueue pull");

        const verifiedPush = sessionUpdates.find((u: any) => u.update.$push?.verifiedExerciseIds === "ex-1");
        assert.isDefined(verifiedPush, "expected verifiedExerciseIds push");

        const contributedPush = exerciseUpdates.find((u: any) => u.update.$push?.userContributedAnswers === "jeg spiser");
        assert.isDefined(contributedPush, "expected userContributedAnswers push");
    });

    it("returns { valid: false, explanation } and does not mutate any state when AI rejects the translation", async () => {

        const { config, sessionUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            makeSessionBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: false, explanation: "That phrase is informal and not accepted." }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg ede", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isFalse(result.valid);
        assert.equal(result.explanation, "That phrase is informal and not accepted.");

        assert.equal(sessionUpdates.length, 0, "no session mutations expected");
        assert.equal(exerciseUpdates.length, 0, "no exercise mutations expected");
    });

    it("returns { valid: true } and flips the answer on the module test attempt when AI validates the translation", async () => {

        const { config, attemptUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            null,
            makeAttemptBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: true }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spiser", sessionId: ATTEMPT_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.isUndefined(result.explanation);

        const flip = attemptUpdates.find((u: any) => u.filter["answers.exerciseId"] === "ex-1" && u.update.$set?.["answers.$.isCorrect"] === true);
        assert.isDefined(flip, "expected isCorrect to be flipped to true");

        const verifiedPush = attemptUpdates.find((u: any) => u.update.$push?.verifiedExerciseIds === "ex-1");
        assert.isDefined(verifiedPush, "expected verifiedExerciseIds push");

        const retryPull = attemptUpdates.find((u: any) => u.update.$pull?.retryQueue !== undefined);
        assert.isUndefined(retryPull, "module test attempts have no retry queue");

        const contributedPush = exerciseUpdates.find((u: any) => u.update.$push?.userContributedAnswers === "jeg spiser");
        assert.isDefined(contributedPush, "expected userContributedAnswers push");
    });

    it("returns { valid: false, explanation } and does not mutate the module test attempt when AI rejects the translation", async () => {

        const { config, attemptUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            null,
            makeAttemptBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: false, explanation: "That phrase is informal and not accepted." }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg ede", sessionId: ATTEMPT_ID, cefrLevel: "A1" });

        assert.isFalse(result.valid);
        assert.equal(result.explanation, "That phrase is informal and not accepted.");

        assert.equal(attemptUpdates.length, 0, "no attempt mutations expected");
        assert.equal(exerciseUpdates.length, 0, "no exercise mutations expected");
    });

    it("throws 400 when the exercise is not part of the module test attempt", async () => {

        const attempt = makeAttemptBSON({ exerciseIds: ["ex-2"] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null, attempt);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: ATTEMPT_ID, cefrLevel: "A1" });
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 409 when verification was already used for this (attemptId, exerciseId) pair", async () => {

        const attempt = makeAttemptBSON({ verifiedExerciseIds: ["ex-1"] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null, attempt);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: ATTEMPT_ID, cefrLevel: "A1" });
            assert.fail("Expected 409");
        } catch (err: any) {
            assert.equal(err.code, 409);
        }
    });

    it("throws 404 when the sessionId matches none of a practice session, a module test attempt, or a level test attempt", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null, null, null);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: ATTEMPT_ID, cefrLevel: "A1" });
            assert.fail("Expected 404");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("returns { valid: true } and flips the answer on the level test attempt when AI validates the translation", async () => {

        const { config, levelTestAttemptUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            null,
            null,
            makeLevelTestAttemptBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: true }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spiser", sessionId: LEVEL_TEST_ATTEMPT_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.isUndefined(result.explanation);

        const flip = levelTestAttemptUpdates.find((u: any) => u.filter["answers.exerciseId"] === "ex-1" && u.update.$set?.["answers.$.isCorrect"] === true);
        assert.isDefined(flip, "expected isCorrect to be flipped to true");

        const verifiedPush = levelTestAttemptUpdates.find((u: any) => u.update.$push?.verifiedExerciseIds === "ex-1");
        assert.isDefined(verifiedPush, "expected verifiedExerciseIds push");

        const retryPull = levelTestAttemptUpdates.find((u: any) => u.update.$pull?.retryQueue !== undefined);
        assert.isUndefined(retryPull, "level test attempts have no retry queue");

        const contributedPush = exerciseUpdates.find((u: any) => u.update.$push?.userContributedAnswers === "jeg spiser");
        assert.isDefined(contributedPush, "expected userContributedAnswers push");
    });

    it("returns { valid: false, explanation } and does not mutate the level test attempt when AI rejects the translation", async () => {

        const { config, levelTestAttemptUpdates, exerciseUpdates } = makeMockConfig(
            makeTranslationExercise("ex-1"),
            makeVocabBSON(),
            null,
            null,
            makeLevelTestAttemptBSON()
        );

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient(JSON.stringify({ valid: false, explanation: "That phrase is informal and not accepted." }));

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg ede", sessionId: LEVEL_TEST_ATTEMPT_ID, cefrLevel: "A1" });

        assert.isFalse(result.valid);
        assert.equal(result.explanation, "That phrase is informal and not accepted.");

        assert.equal(levelTestAttemptUpdates.length, 0, "no level test attempt mutations expected");
        assert.equal(exerciseUpdates.length, 0, "no exercise mutations expected");
    });

    it("throws 400 when the exercise is not part of the level test attempt", async () => {

        const levelTestAttempt = makeLevelTestAttemptBSON({ exerciseIds: ["ex-2"] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null, null, levelTestAttempt);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: LEVEL_TEST_ATTEMPT_ID, cefrLevel: "A1" });
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 409 when verification was already used for this (levelTestAttemptId, exerciseId) pair", async () => {

        const levelTestAttempt = makeLevelTestAttemptBSON({ verifiedExerciseIds: ["ex-1"] });
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), null, null, levelTestAttempt);
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = makeMockAIClient("{}");

        try {
            await delegate.do({ exerciseId: "ex-1", userAnswer: "hej", sessionId: LEVEL_TEST_ATTEMPT_ID, cefrLevel: "A1" });
            assert.fail("Expected 409");
        } catch (err: any) {
            assert.equal(err.code, 409);
        }
    });

    it("sends a prompt to the AI that instructs it to disregard punctuation differences", async () => {

        const capturedPrompts: string[] = [];
        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = { generate: async (prompt: string) => { capturedPrompts.push(prompt); return JSON.stringify({ valid: true }); } };

        await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spiser.", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.match(capturedPrompts[0], /ignore punctuation/i, "expected the prompt to instruct the AI to ignore punctuation differences");
    });
});

/**
 * Builds an AI client that replays the given responses in order (1st call = verdict, 2nd call = note on a valid answer)
 * and records every prompt it receives. A response that is an Error is thrown instead of returned.
 */
function makeSequencedAIClient(responses: (string | Error)[]) {

    const prompts: string[] = [];

    const client: VertexAIClient = {
        generate: async (prompt: string) => {
            prompts.push(prompt);
            const next = responses[prompts.length - 1];
            if (next instanceof Error) throw next;
            return next;
        }
    };

    return { client, prompts };
}

describe("PostExerciseAnswerVerification.do — judging against real-world Danish (issue #106)", () => {

    it("accepts a correct answer that differs from the expected one and returns a note about it", async () => {

        const { config, sessionUpdates } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([
            JSON.stringify({ reasoning: "Natural and correct Danish.", valid: true }),
            JSON.stringify({ explanation: "Correct! 'jeg spiser mad' is another common way to say this." }),
        ]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg æder", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.equal(result.explanation, "Correct! 'jeg spiser mad' is another common way to say this.");
        assert.equal(prompts.length, 2, "expected one verdict call and one note call");
        assert.isDefined(sessionUpdates.find((u: any) => u.update.$push?.verifiedExerciseIds === "ex-1"), "expected the verification to be recorded");
    });

    it("rejects an answer with a grammar error, returns the explanation and skips the note call", async () => {

        const { config, sessionUpdates, exerciseUpdates } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([
            JSON.stringify({ reasoning: "The verb is not conjugated.", valid: false, explanation: "The verb must be in the present tense: 'spiser'." }),
        ]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spise", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isFalse(result.valid);
        assert.equal(result.explanation, "The verb must be in the present tense: 'spiser'.");
        assert.equal(prompts.length, 1, "the note call must only happen for valid answers");
        assert.equal(sessionUpdates.length, 0);
        assert.equal(exerciseUpdates.length, 0);
    });

    it("rejects an answer that changes the meaning", async () => {

        const { config, sessionUpdates, exerciseUpdates } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client } = makeSequencedAIClient([
            JSON.stringify({ reasoning: "'drikker' means 'drink'.", valid: false, explanation: "'drikker' means 'drink', not 'eat'." }),
        ]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg drikker", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isFalse(result.valid);
        assert.equal(result.explanation, "'drikker' means 'drink', not 'eat'.");
        assert.equal(sessionUpdates.length, 0);
        assert.equal(exerciseUpdates.length, 0);
    });

    it("accepts a correct answer that skips the target vocabulary word", async () => {

        const { config, exerciseUpdates } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([
            JSON.stringify({ reasoning: "Correct and natural, even without the target word.", valid: true }),
            JSON.stringify({ explanation: "Correct! The target word here was 'spise', but this works too." }),
        ]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg indtager min mad", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.include(result.explanation, "spise");
        assert.isDefined(exerciseUpdates.find((u: any) => u.update.$push?.userContributedAnswers === "jeg indtager min mad"));
        assert.include(prompts[1], "spise", "the note step is the one that sees the target word");
    });

    it("does not include the accepted answers or the linked vocabulary item in the verdict prompt", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([JSON.stringify({ reasoning: "ok", valid: true }), JSON.stringify({})]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg æder", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.include(prompts[0], "I eat");
        assert.include(prompts[0], "jeg æder");
        assert.include(prompts[0], "A1");
        assert.notInclude(prompts[0], "jeg spiser", "the verdict prompt must not contain the accepted answers");
        assert.notInclude(prompts[0], "jeg spiser mad", "the verdict prompt must not contain the alternative answers");
        assert.notInclude(prompts[0], "spise", "the verdict prompt must not contain the linked vocabulary item");
        assert.notInclude(prompts[0], "used for eating food", "the verdict prompt must not contain the vocabulary context");
        assert.notMatch(prompts[0], /accepted answers/i);
    });

    it("asks the model for its reasoning before the verdict", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([JSON.stringify({ reasoning: "ok", valid: true }), JSON.stringify({})]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg æder", sessionId: SESSION_ID, cefrLevel: "A1" });

        const fields = prompts[0].slice(prompts[0].indexOf("exactly these fields"));

        assert.isAbove(fields.indexOf("reasoning"), -1);
        assert.isBelow(fields.indexOf("reasoning"), fields.indexOf("valid"), "reasoning must be listed before valid");
    });

    it("gives the note step the accepted answers and the target vocabulary item", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client, prompts } = makeSequencedAIClient([JSON.stringify({ reasoning: "ok", valid: true }), JSON.stringify({})]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg æder", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.include(prompts[1], "jeg spiser");
        assert.include(prompts[1], "jeg spiser mad");
        assert.include(prompts[1], "spise");
        assert.include(prompts[1], "jeg æder");
    });

    it("returns no explanation when the note step has nothing to add", async () => {

        const { config } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client } = makeSequencedAIClient([JSON.stringify({ reasoning: "ok", valid: true }), JSON.stringify({})]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg spiser", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.isUndefined(result.explanation);
    });

    it("still returns valid: true when the note step fails", async () => {

        const { config, exerciseUpdates } = makeMockConfig(makeTranslationExercise("ex-1"), makeVocabBSON(), makeSessionBSON());
        const { client } = makeSequencedAIClient([JSON.stringify({ reasoning: "ok", valid: true }), new Error("Vertex AI unavailable")]);

        const delegate = new PostExerciseAnswerVerification({} as any, config);
        delegate.aiClient = client;

        const result = await delegate.do({ exerciseId: "ex-1", userAnswer: "jeg æder", sessionId: SESSION_ID, cefrLevel: "A1" });

        assert.isTrue(result.valid);
        assert.isUndefined(result.explanation);
        assert.isDefined(exerciseUpdates.find((u: any) => u.update.$push?.userContributedAnswers === "jeg æder"), "the verdict must still be applied");
    });
});
