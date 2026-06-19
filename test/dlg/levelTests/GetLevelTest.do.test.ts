import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetLevelTest } from "../../../src/dlg/levelTests/GetLevelTest";
import { Exercise } from "../../../src/model/Exercise";

function makeExerciseBSON(id: string): any {
    return new Exercise({ id, moduleId: null, type: "translation_active", prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: "v-1", grammarConceptId: null }).toBSON();
}

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [{ exerciseId: "ex-1", isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-16T10:00:00.000Z" }],
        currentPosition: 1,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-16T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[]) {

    const collections: Record<string, any> = {
        levelTestAttempts: { findOne: async (f: any) => (attemptDoc && attemptDoc._id.equals(f._id) ? attemptDoc : null) },
        exercises: { find: () => ({ toArray: async () => exerciseDocs }) },
    };

    return { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any;
}

describe("GetLevelTest.do", () => {

    it("returns the attempt state with full exercises, answers and currentPosition", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1"), makeExerciseBSON("ex-2")]);
        const delegate = new GetLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.attemptId, oid.toString());
        assert.equal(result.cefrLevel, "A1");
        assert.equal(result.exercises.length, 2);
        assert.equal(result.answers.length, 1);
        assert.equal(result.currentPosition, 1);
        assert.equal(result.takenAt, null);
    });

    it("throws 404 when the attempt does not exist", async () => {

        const config = makeMockConfig(null, []);
        const delegate = new GetLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString() }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 403 when the attempt belongs to a different user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid, { userId: "someone-else" }), [makeExerciseBSON("ex-1")]);
        const delegate = new GetLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 403");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });
});
