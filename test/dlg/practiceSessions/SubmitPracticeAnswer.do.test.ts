import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitPracticeAnswer } from "../../../src/dlg/practiceSessions/SubmitPracticeAnswer";
import { Exercise } from "../../../src/model/Exercise";

function makeExerciseBSON(id: string, answer: string, alternatives: string[] = []): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer,
        alternativeAnswers: alternatives,
        userContributedAnswers: [],
        vocabularyItemId: "v-1",
    }).toBSON();
}

function makeSessionBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

/**
 * Builds a mock config wiring up practiceSessions and exercises collections.
 * Captures mutations so tests can verify them.
 */
function makeMockConfig(sessionDoc: any, exerciseDoc: any) {

    const mutations: string[] = [];
    let currentSession: any = sessionDoc ? { ...sessionDoc } : null;

    const practiceSessionsCollection = {
        findOne: async (filter: any) => {
            if (filter._id) return currentSession;
            return null;
        },
        updateOne: async (_filter: any, update: any) => {
            if (update.$push?.answers) {
                currentSession.answers = [...(currentSession.answers ?? []), update.$push.answers];
                mutations.push("appendAnswer");
            }
            if (update.$inc?.currentPosition !== undefined) {
                currentSession.currentPosition = (currentSession.currentPosition ?? 0) + 1;
                mutations.push("advancePosition");
            }
            if (update.$push?.retryQueue) {
                currentSession.retryQueue = [...(currentSession.retryQueue ?? []), update.$push.retryQueue];
                mutations.push("addToRetryQueue");
            }
            return { matchedCount: 1 };
        },
    };

    const exercisesCollection = {
        findOne: async (_filter: any) => exerciseDoc,
        updateOne: async (_filter: any, _update: any) => {
            mutations.push("incrementTimesShown");
            return { matchedCount: 1 };
        },
    };

    const collections: Record<string, any> = {
        practiceSessions: practiceSessionsCollection,
        exercises: exercisesCollection,
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        mutations,
        getCurrentSession: () => currentSession,
    };
}

describe("SubmitPracticeAnswer.do", () => {

    it("marks the answer correct, advances position, and increments timesShown", async () => {

        const oid = new ObjectId();
        const { config, mutations } = makeMockConfig(makeSessionBSON(oid), makeExerciseBSON("ex-1", "hej"));

        const delegate = new SubmitPracticeAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" },
            { userId: "user-1" } as any
        );

        assert.isTrue(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
        assert.include(mutations, "appendAnswer");
        assert.include(mutations, "advancePosition");
        assert.include(mutations, "incrementTimesShown");
        assert.notInclude(mutations, "addToRetryQueue");
    });

    it("marks the answer incorrect, adds to retryQueue, advances position, and returns the correct answer", async () => {

        const oid = new ObjectId();
        const { config, mutations } = makeMockConfig(makeSessionBSON(oid), makeExerciseBSON("ex-1", "hej"));

        const delegate = new SubmitPracticeAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-1", userAnswer: "farvel" },
            { userId: "user-1" } as any
        );

        assert.isFalse(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
        assert.include(mutations, "appendAnswer");
        assert.include(mutations, "addToRetryQueue");
        assert.include(mutations, "advancePosition");
    });

    it("accepts alternative answers as correct", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(
            makeSessionBSON(oid),
            makeExerciseBSON("ex-1", "hej", ["goddag"])
        );

        const delegate = new SubmitPracticeAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-1", userAnswer: "Goddag" },
            { userId: "user-1" } as any
        );

        assert.isTrue(result.isCorrect);
    });

    it("throws 404 when the session does not exist", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(null as any, makeExerciseBSON("ex-1", "hej"));

        const delegate = new SubmitPracticeAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the session is already completed", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(
            makeSessionBSON(oid, { completedAt: "2026-06-09T11:00:00.000Z" }),
            makeExerciseBSON("ex-1", "hej")
        );

        const delegate = new SubmitPracticeAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the exerciseId is not part of the session", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeSessionBSON(oid), makeExerciseBSON("ex-99", "hej"));

        const delegate = new SubmitPracticeAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", sessionId: oid.toString(), exerciseId: "ex-99", userAnswer: "hej" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
