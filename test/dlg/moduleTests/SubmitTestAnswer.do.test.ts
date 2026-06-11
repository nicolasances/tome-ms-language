import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitTestAnswer } from "../../../src/dlg/moduleTests/SubmitTestAnswer";
import { Exercise } from "../../../src/model/Exercise";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockConfig(attemptDoc: any | null, exerciseDoc: any | null) {

    const mutations: string[] = [];
    let currentAttempt: any = attemptDoc ? { ...attemptDoc } : null;

    const collections: Record<string, any> = {
        moduleTestAttempts: {
            findOne: async (filter: any) => {
                if (!currentAttempt) return null;
                if (filter._id) return currentAttempt._id.equals(filter._id) ? currentAttempt : null;
                return null;
            },
            updateOne: async (_filter: any, update: any) => {
                if (!currentAttempt) return { matchedCount: 0 };
                if (update.$push?.answers) {
                    currentAttempt.answers = [...(currentAttempt.answers ?? []), update.$push.answers];
                    mutations.push("appendAnswer");
                }
                if (update.$inc?.currentPosition !== undefined) {
                    currentAttempt.currentPosition = (currentAttempt.currentPosition ?? 0) + 1;
                    mutations.push("advancePosition");
                }
                return { matchedCount: 1 };
            },
        },
        exercises: {
            findOne: async () => exerciseDoc,
            updateOne: async () => {
                mutations.push("incrementTimesShown");
                return { matchedCount: 1 };
            },
        },
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        mutations,
        getCurrentAttempt: () => currentAttempt,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SubmitTestAnswer.do", () => {

    it("marks the answer correct, advances cursor, and increments timesShown", async () => {

        const oid = new ObjectId();
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid), makeExerciseBSON("ex-1", "hej"));
        const delegate = new SubmitTestAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" },
            {} as any
        );

        assert.isTrue(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
        assert.include(mutations, "appendAnswer");
        assert.include(mutations, "advancePosition");
        assert.include(mutations, "incrementTimesShown");
    });

    it("marks the answer incorrect and returns the correct answer as immediate feedback", async () => {

        const oid = new ObjectId();
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid), makeExerciseBSON("ex-1", "hej"));
        const delegate = new SubmitTestAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "farvel" },
            {} as any
        );

        assert.isFalse(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
        assert.include(mutations, "appendAnswer");
        assert.include(mutations, "advancePosition");
    });

    it("does NOT add to any retry queue — first answer is final", async () => {

        const oid = new ObjectId();
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid), makeExerciseBSON("ex-1", "hej"));
        const delegate = new SubmitTestAnswer({} as any, config);

        await delegate.do(
            { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "farvel" },
            {} as any
        );

        assert.notInclude(mutations, "addToRetryQueue");
    });

    it("accepts alternative answers as correct", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid), makeExerciseBSON("ex-1", "hej", ["goddag"]));
        const delegate = new SubmitTestAnswer({} as any, config);

        const result = await delegate.do(
            { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "Goddag" },
            {} as any
        );

        assert.isTrue(result.isCorrect);
    });

    it("throws 404 when the attempt does not exist", async () => {

        const { config } = makeMockConfig(null, makeExerciseBSON("ex-1", "hej"));
        const delegate = new SubmitTestAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", attemptId: new ObjectId().toString(), exerciseId: "ex-1", userAnswer: "hej" },
                {} as any
            );
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the attempt is already submitted (takenAt set)", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(
            makeAttemptBSON(oid, { takenAt: "2026-06-11T11:00:00.000Z" }),
            makeExerciseBSON("ex-1", "hej")
        );
        const delegate = new SubmitTestAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" },
                {} as any
            );
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the exerciseId is not part of the attempt", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid), makeExerciseBSON("ex-99", "hej"));
        const delegate = new SubmitTestAnswer({} as any, config);

        try {

            await delegate.do(
                { userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-99", userAnswer: "hej" },
                {} as any
            );
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
