import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitLevelTestAnswer } from "../../../src/dlg/levelTests/SubmitLevelTestAnswer";
import { Exercise } from "../../../src/model/Exercise";

function makeExerciseBSON(id: string, answer: string): any {
    return new Exercise({ id, moduleId: null, type: "translation_active", prompt: `prompt-${id}`, answer, vocabularyItemId: "v-1", grammarConceptId: null }).toBSON();
}

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
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

    const mutations: any[] = [];
    const current = attemptDoc ? { ...attemptDoc } : null;
    const exerciseMap = new Map(exerciseDocs.map((e: any) => [e.id, e]));

    const collections: Record<string, any> = {
        levelTestAttempts: {
            findOne: async (f: any) => (current && current._id.equals(f._id) ? current : null),
            updateOne: async (_f: any, update: any) => { mutations.push(update); if (update.$push) for (const [k, v] of Object.entries(update.$push as any)) (current as any)[k] = [...((current as any)[k] ?? []), v]; if (update.$inc) for (const [k, v] of Object.entries(update.$inc as any)) (current as any)[k] = ((current as any)[k] ?? 0) + (v as number); return { matchedCount: 1 }; },
        },
        exercises: {
            findOne: async (f: any) => exerciseMap.get(f.id) ?? null,
            updateOne: async () => ({ matchedCount: 1 }),
        },
    };

    return { config: { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any, mutations, getCurrent: () => current };
}

describe("SubmitLevelTestAnswer.do", () => {

    it("returns isCorrect=true and the correct answer for a correct submission", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1", "hej")]);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" }, {} as any);

        assert.isTrue(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
    });

    it("returns isCorrect=false and the correct answer for a wrong submission (immediate feedback)", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1", "hej")]);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "wrong" }, {} as any);

        assert.isFalse(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
    });

    it("stores the answer and advances the cursor", async () => {

        const oid = new ObjectId();
        const { config, getCurrent } = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1", "hej")]);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" }, {} as any);

        const current = getCurrent();
        assert.equal(current.answers.length, 1);
        assert.equal(current.answers[0].exerciseId, "ex-1");
        assert.equal(current.currentPosition, 1);
    });

    it("throws 400 when the exercise is not part of the attempt", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid), [makeExerciseBSON("ex-1", "hej")]);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-99", userAnswer: "hej" }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the attempt is already submitted", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig(makeAttemptBSON(oid, { takenAt: "2026-06-16T11:00:00.000Z" }), [makeExerciseBSON("ex-1", "hej")]);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString(), exerciseId: "ex-1", userAnswer: "hej" }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 404 when the attempt does not exist", async () => {

        const { config } = makeMockConfig(null, []);
        const delegate = new SubmitLevelTestAnswer({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString(), exerciseId: "ex-1", userAnswer: "hej" }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });
});
