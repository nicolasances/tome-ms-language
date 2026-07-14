import { assert } from "chai";
import { ObjectId } from "mongodb";
import { StartModuleTest } from "../../../src/dlg/moduleTests/StartModuleTest";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { UserModuleProgress, TestAttemptRecord } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(overrides: Partial<ConstructorParameters<typeof Module>[0]> = {}): Module {
    return new Module({
        id: "mod-1",
        title: "A1 Basics",
        theme: "greetings",
        communicationGoal: "greet people",
        cefrLevel: "A1",
        vocabularyItemIds: ["v-1", "v-2"],
        grammarConceptIds: [],
        practiceSessionSize: 4,
        ...overrides,
    });
}

function makeExercise(id: string, vocabId: string = "v-1"): Exercise {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: vocabId,
        grammarConceptId: null,
    });
}

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: null,
        testAttempts: [],
        practiceCompletedAt: "2026-06-01T00:00:00.000Z", // long ago — unlocked
        ...overrides,
    });
}

/**
 * Builds 22 distinct exercises (more than the 20-exercise draw) linked to 2 vocab items.
 */
function makeLargeExercisePool(): Exercise[] {
    return Array.from({ length: 22 }, (_, i) => makeExercise(`ex-${i + 1}`, i % 2 === 0 ? "v-1" : "v-2"));
}

/**
 * Builds a mock config that simulates:
 * - modules collection returning moduleBSON on findOne
 * - exercises collection returning exerciseBSONs on find
 * - userModuleProgress collection returning progressBSON on findOne; replaceOne no-op
 * - userVocabularyProgress / userGrammarProgress: empty (no mastery yet)
 * - moduleTestAttempts: no active attempt (findOne returns null), insertOne returns an oid
 */
function makeMockConfig(moduleBSON: any, exerciseBSONs: any[], progressBSON: any | null, activeAttemptBSON: any | null = null) {

    const insertedOid = new ObjectId();

    const collections: Record<string, any> = {
        modules: {
            findOne: async () => moduleBSON,
        },
        exercises: {
            find: () => ({ toArray: async () => exerciseBSONs }),
        },
        userModuleProgress: {
            findOne: async () => progressBSON,
            replaceOne: async () => ({ upsertedCount: 1 }),
        },
        userVocabularyProgress: {
            find: () => ({ toArray: async () => [] }),
        },
        userGrammarProgress: {
            find: () => ({ toArray: async () => [] }),
        },
        moduleTestAttempts: {
            findOne: async () => activeAttemptBSON,
            insertOne: async () => ({ insertedId: insertedOid }),
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

describe("StartModuleTest.do", () => {

    it("returns an attemptId, startedAt, and the selected full exercise objects (same payload as practice)", async () => {

        const mod = makeModule();
        const exercises = makeLargeExercisePool();
        const progress = makeProgress();

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        assert.isString(result.attemptId);
        assert.isString(result.startedAt);
        assert.isArray(result.exercises);
        assert.equal(result.exercises.length, 20);

        // Full exercise payload — same shape as a practice session (frontend reuses the components)
        for (const ex of result.exercises) {
            assert.isString((ex as any).answer, "exercises must include the answer, like a practice session");
        }
    });

    it("returns multiple_choice exercises with both answer and distractors (same payload as practice)", async () => {

        const mod = makeModule();
        const mc = new Exercise({ id: "ex-mc", moduleId: "mod-1", type: "multiple_choice", prompt: "Choose", promptTranslation: "Choose", answer: "spiser", distractors: ["drikker", "løber"], vocabularyItemId: "v-1", grammarConceptId: null });
        const progress = makeProgress();

        const config = makeMockConfig(mod.toBSON(), [mc.toBSON()], progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        const out = result.exercises.find((e: any) => e.id === "ex-mc") as any;
        assert.isDefined(out);
        assert.equal(out.answer, "spiser", "answer must be present for component reuse");
        assert.deepEqual(out.distractors, ["drikker", "løber"], "distractors must be present");
    });

    it("draws exactly 20 exercises when the pool is large enough", async () => {

        const mod = makeModule();
        const exercises = makeLargeExercisePool();
        const progress = makeProgress();

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        assert.equal(result.exercises.length, 20);
    });

    it("draws module.testQuestionCount exercises, not the global MODULE_TEST_SIZE constant", async () => {

        // Module configured with 10 questions instead of the default 20
        const mod = makeModule({ testQuestionCount: 10 });
        // Pool of 22 exercises — big enough that any clamping to pool size would not affect the assertion
        const exercises = makeLargeExercisePool();
        const progress = makeProgress();

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        assert.equal(result.exercises.length, 10);
    });

    it("throws 409 with attemptId when an active attempt already exists", async () => {

        const mod = makeModule();
        const exercises = makeLargeExercisePool();
        const progress = makeProgress();
        const existingAttemptOid = new ObjectId();

        const activeAttemptBSON = {
            _id: existingAttemptOid,
            userId: "user-1",
            moduleId: "mod-1",
            exerciseIds: [],
            answers: [],
            currentPosition: 0,
            verifiedExerciseIds: [],
            score: null,
            passed: null,
            startedAt: "2026-06-11T09:00:00.000Z",
            takenAt: null,
            exerciseResults: [],
        };

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON(), activeAttemptBSON);
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 409 error");

        } catch (err: any) {

            assert.equal(err.code, 409);
            assert.equal(err.attemptId, existingAttemptOid.toString());
        }
    });

    it("throws 404 when the module is not found", async () => {

        const config = makeMockConfig(null, [], makeProgress().toBSON());
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 404 error");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when practiceCompletedAt is null (Step 2 not complete)", async () => {

        const mod = makeModule();
        const progress = makeProgress({ practiceCompletedAt: null });

        const config = makeMockConfig(mod.toBSON(), [], progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the unlock delay has not elapsed", async () => {

        const mod = makeModule();
        // practiceCompletedAt was 2 hours ago — unlock requires 4 hours
        const twoHoursAgo = new Date(new Date("2026-06-11T14:00:00.000Z").getTime() - 2 * 60 * 60 * 1000).toISOString();
        const progress = makeProgress({ practiceCompletedAt: twoHoursAgo });

        const config = makeMockConfig(mod.toBSON(), [], progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the module is already completed (OQ-03: no retakes)", async () => {

        const mod = makeModule();
        const progress = makeProgress({ status: "completed" });

        const config = makeMockConfig(mod.toBSON(), makeLargeExercisePool().map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the retry delay has not elapsed after a failed attempt", async () => {

        const mod = makeModule();
        // Failed attempt 10 minutes ago; retry delay is 20 minutes
        const tenMinutesAgo = new Date(new Date("2026-06-11T14:00:00.000Z").getTime() - 10 * 60 * 1000).toISOString();
        const failedAttempt = new TestAttemptRecord({ id: "att-1", score: 50, passed: false, takenAt: tenMinutesAgo });
        const progress = makeProgress({ testAttempts: [failedAttempt] });

        const config = makeMockConfig(mod.toBSON(), makeLargeExercisePool().map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);
            assert.fail("Expected 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("selects at least 60% translation_active exercises when the pool is large enough (F11 floor)", async () => {

        const mod = makeModule();
        const progress = makeProgress();

        // 20 translation_active + 80 multiple_choice = 100 exercises, each with a unique vocab ID.
        // Without the split-selection fix the unconstrained F08 draw produces ~4 ta exercises (20%),
        // which is well below the 60% floor and would fail the assertion.
        const translationExercises = Array.from({ length: 20 }, (_, i) =>
            new Exercise({ id: `ta-${i + 1}`, moduleId: "mod-1", type: "translation_active", prompt: `p-ta-${i}`, answer: `a-ta-${i}`, vocabularyItemId: `ta-v-${i + 1}`, grammarConceptId: null })
        );
        const multipleChoiceExercises = Array.from({ length: 80 }, (_, i) =>
            new Exercise({ id: `mc-${i + 1}`, moduleId: "mod-1", type: "multiple_choice", prompt: `p-mc-${i}`, answer: `a-mc-${i}`, vocabularyItemId: `mc-v-${i + 1}`, grammarConceptId: null, distractors: ["d1", "d2"] })
        );
        const pool = [...translationExercises, ...multipleChoiceExercises];

        const config = makeMockConfig(mod.toBSON(), pool.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        const translationCount = result.exercises.filter((e: any) => e.type === "translation_active").length;
        const minExpected = Math.ceil(20 * 0.60); // 12

        assert.equal(result.exercises.length, 20);
        assert.isAtLeast(translationCount, minExpected, `Expected at least ${minExpected} translation_active exercises, got ${translationCount}`);
    });

    it("uses all available translation_active exercises and fills remainder from other types when translation_active pool is too small (F11 graceful cap)", async () => {

        const mod = makeModule();
        const progress = makeProgress();

        // 3 translation_active + 50 multiple_choice = 53 exercises, each with a unique vocab ID.
        // Without the fix the unconstrained draw produces on average ~1 ta exercise (3/53 * 20),
        // so the assertion of exactly 3 ta exercises would reliably fail without the fix.
        const translationExercises = Array.from({ length: 3 }, (_, i) =>
            new Exercise({ id: `ta-${i + 1}`, moduleId: "mod-1", type: "translation_active", prompt: `p-ta-${i}`, answer: `a-ta-${i}`, vocabularyItemId: `ta-v-${i + 1}`, grammarConceptId: null })
        );
        const multipleChoiceExercises = Array.from({ length: 50 }, (_, i) =>
            new Exercise({ id: `mc-${i + 1}`, moduleId: "mod-1", type: "multiple_choice", prompt: `p-mc-${i}`, answer: `a-mc-${i}`, vocabularyItemId: `mc-v-${i + 1}`, grammarConceptId: null, distractors: ["d1", "d2"] })
        );
        const pool = [...translationExercises, ...multipleChoiceExercises];

        const config = makeMockConfig(mod.toBSON(), pool.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        const translationCount = result.exercises.filter((e: any) => e.type === "translation_active").length;
        const uniqueIds = new Set(result.exercises.map((e: any) => e.id));

        assert.equal(result.exercises.length, 20, "must return exactly 20 exercises");
        assert.equal(translationCount, 3, "must use all 3 available translation_active exercises");
        assert.equal(uniqueIds.size, 20, "must not repeat exercises");
    });
});
