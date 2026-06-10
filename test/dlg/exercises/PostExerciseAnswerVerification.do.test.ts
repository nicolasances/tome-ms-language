import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PostExerciseAnswerVerification } from "../../../src/dlg/exercises/PostExerciseAnswerVerification";
import { Exercise } from "../../../src/model/Exercise";
import { VocabularyItem } from "../../../src/model/VocabularyItem";
import { VertexAIClient } from "../../../src/ai/VertexAIClient";

const SESSION_ID = new ObjectId().toString();

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

function makeMockAIClient(response: string): VertexAIClient {
    return { generate: async (_prompt: string) => response };
}

/**
 * Builds a mock config. Tracks all updateOne calls for assertion.
 * exerciseUpdates: calls on the exercises collection
 * sessionUpdates: calls on the practiceSessions collection
 */
function makeMockConfig(exerciseDoc: any, vocabDoc: any, sessionDoc: any) {

    const exerciseUpdates: any[] = [];
    const sessionUpdates: any[] = [];

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
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        exerciseUpdates,
        sessionUpdates,
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
});
