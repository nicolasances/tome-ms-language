import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitModuleTest } from "../../../src/dlg/moduleTests/SubmitModuleTest";
import { Exercise } from "../../../src/model/Exercise";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExerciseBSON(id: string, vocabId: string = "v-1"): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: vocabId,
        grammarConceptId: null,
    }).toBSON();
}

/**
 * Builds an attempt BSON with `count` exercises, `correctCount` of which are answered correctly.
 */
function makeAttemptBSON(oid: ObjectId, count: number, correctCount: number, overrides: any = {}): any {

    const exerciseIds = Array.from({ length: count }, (_, i) => `ex-${i + 1}`);
    const answers = exerciseIds.map((id, i) => ({
        exerciseId: id,
        isCorrect: i < correctCount,
        userAnswer: "hej",
        answeredAt: "2026-06-11T10:00:00.000Z",
    }));

    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds,
        answers,
        currentPosition: count,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

/**
 * Builds a mock config wiring all collections needed by SubmitModuleTest.
 * Records mutations for assertion.
 */
function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[]) {

    const mutations: any[] = [];
    let currentAttempt: any = attemptDoc ? { ...attemptDoc } : null;

    const exerciseMap = new Map(exerciseDocs.map((e: any) => [e.id, e]));

    const collections: Record<string, any> = {
        moduleTestAttempts: {
            findOne: async (filter: any) => {
                if (!currentAttempt) return null;
                if (filter._id) return currentAttempt._id.equals(filter._id) ? currentAttempt : null;
                return null;
            },
            updateOne: async (_filter: any, update: any) => {
                if (!currentAttempt) return { matchedCount: 0 };
                if (update.$set) Object.assign(currentAttempt, update.$set);
                mutations.push({ op: "submitAttempt", update });
                return { matchedCount: 1 };
            },
        },
        exercises: {
            find: (_filter: any) => ({ toArray: async () => exerciseDocs }),
        },
        userModuleProgress: {
            findOne: async () => ({
                userId: "user-1",
                moduleId: "mod-1",
                status: "in_progress",
                startedAt: "2026-06-01T09:00:00.000Z",
                completedAt: null,
                vocabularyItemsPracticed: [],
                practiceCompletedAt: "2026-06-01T00:00:00.000Z",
                testAttempts: [],
            }),
            replaceOne: async (_f: any, doc: any) => {
                mutations.push({ op: "upsertProgress", doc });
                return { upsertedCount: 1 };
            },
            updateOne: async (_filter: any, update: any) => {
                mutations.push({ op: "appendTestAttempt", update });
                return { matchedCount: 1 };
            },
        },
        userVocabularyProgress: {
            findOne: async () => null,
            replaceOne: async (_f: any, doc: any) => {
                mutations.push({ op: "upsertVocabProgress", doc });
                return { upsertedCount: 1 };
            },
        },
        userGrammarProgress: {
            findOne: async () => null,
            replaceOne: async () => ({ upsertedCount: 1 }),
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

describe("SubmitModuleTest.do", () => {

    it("computes a passing score (100%) when all exercises are answered correctly", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 20, 20), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 100);
        assert.isTrue(result.passed);
    });

    it("computes a failing score when fewer than 80% are correct", async () => {

        const oid = new ObjectId();
        // 15 correct out of 20 = 75% → fail
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 20, 15), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 75);
        assert.isFalse(result.passed);
    });

    it("counts unanswered exercises as wrong when computing the score", async () => {

        const oid = new ObjectId();
        // 10 exercises, 8 answered and all correct, 2 unanswered → score = 8/10 = 80%
        const exercises = Array.from({ length: 10 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const attemptDoc = makeAttemptBSON(oid, 10, 8);
        // Remove the last 2 answers to simulate unanswered exercises
        attemptDoc.answers = attemptDoc.answers.slice(0, 8);

        const { config } = makeMockConfig(attemptDoc, exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 80);
        assert.isTrue(result.passed);
    });

    it("persists the score, passed flag, and takenAt on the attempt", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations, getCurrentAttempt } = makeMockConfig(makeAttemptBSON(oid, 20, 16), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const submitted = getCurrentAttempt();
        assert.isNumber(submitted.score);
        assert.isBoolean(submitted.passed);
        assert.isString(submitted.takenAt);

        assert.isTrue(mutations.some(m => m.op === "submitAttempt"));
    });

    it("records a TestAttemptRecord summary in UserModuleProgress.testAttempts", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 18), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isTrue(mutations.some(m => m.op === "appendTestAttempt"));
    });

    it("transitions the module to completed on a passing score", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 20), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const progressTransition = mutations.find(m => m.op === "upsertProgress" && m.doc?.status === "completed");
        assert.isTrue(!!progressTransition, "expected module to be transitioned to completed");
    });

    it("does NOT transition the module to completed on a failing score", async () => {

        const oid = new ObjectId();
        // 14/20 = 70% → fail
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 14), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const completedTransition = mutations.find(m => m.op === "upsertProgress" && m.doc?.status === "completed");
        assert.isFalse(!!completedTransition, "module must NOT be transitioned to completed on a fail");
    });

    it("throws 404 when the attempt does not exist", async () => {

        const { config } = makeMockConfig(null, []);
        const delegate = new SubmitModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString() }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the attempt is already submitted", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 5 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 5, 5, { takenAt: "2026-06-11T11:00:00.000Z" }), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
