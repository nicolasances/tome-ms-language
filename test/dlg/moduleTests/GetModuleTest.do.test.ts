import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetModuleTest } from "../../../src/dlg/moduleTests/GetModuleTest";
import { Exercise } from "../../../src/model/Exercise";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [{ exerciseId: "ex-1", isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-11T10:00:00.000Z" }],
        currentPosition: 1,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeExerciseBSON(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: "v-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeMultipleChoiceBSON(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "multiple_choice",
        prompt: `prompt-${id}`,
        promptTranslation: `translation-${id}`,
        answer: "spiser",
        distractors: ["drikker", "løber"],
        vocabularyItemId: "v-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[]) {

    const collections: Record<string, any> = {
        moduleTestAttempts: {
            findOne: async (filter: any) => {
                if (!attemptDoc) return null;
                if (filter._id) return attemptDoc._id.equals(filter._id) ? attemptDoc : null;
                return null;
            },
        },
        exercises: {
            find: () => ({ toArray: async () => exerciseDocs }),
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetModuleTest.do", () => {

    it("returns the attempt state with exercises and answers but without correct answers", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1"), makeExerciseBSON("ex-2")]);
        const delegate = new GetModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.attemptId, oid.toString());
        assert.equal(result.moduleId, "mod-1");
        assert.equal(result.currentPosition, 1);
        assert.equal(result.exercises.length, 2);
        assert.equal(result.answers.length, 1);

        // Correct answers must not be exposed during an in-progress attempt
        for (const ex of result.exercises) {
            assert.isUndefined((ex as any).answer, "exercises must not expose correct answer");
        }
    });

    it("exposes choices (answer + distractors) for multiple_choice exercises without revealing the answer", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid, { exerciseIds: ["ex-mc"], currentPosition: 0, answers: [] }), [makeMultipleChoiceBSON("ex-mc")]);
        const delegate = new GetModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const mc = result.exercises[0] as any;
        assert.isUndefined(mc.answer, "answer must not be exposed");
        assert.isUndefined(mc.distractors, "distractors must not be exposed alongside choices");
        assert.includeMembers(mc.choices, ["spiser", "drikker", "løber"]);
        assert.lengthOf(mc.choices, 3, "choices must include the correct answer plus the distractors");
    });

    it("returns exercises in the stored exerciseIds order, not the storage order", async () => {

        const oid = new ObjectId();
        // exerciseIds order is ex-2 then ex-1; storage returns them ex-1 then ex-2
        const attempt = makeAttemptBSON(oid, { exerciseIds: ["ex-2", "ex-1"], currentPosition: 0, answers: [] });
        const config = makeMockConfig(attempt, [makeExerciseBSON("ex-1"), makeExerciseBSON("ex-2")]);
        const delegate = new GetModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.deepEqual(result.exercises.map((e: any) => e.id), ["ex-2", "ex-1"]);
    });

    it("throws 404 when the attempt is not found", async () => {

        const config = makeMockConfig(null, []);
        const delegate = new GetModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString() }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 403 when the attempt does not belong to the requesting user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid, { userId: "other-user" }), []);
        const delegate = new GetModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 403");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });
});
