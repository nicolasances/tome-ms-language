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

    it("returns an attemptId, startedAt, and the selected exercises (without answers)", async () => {

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

        // Answers must be stripped from exercises returned to the client
        for (const ex of result.exercises) {
            assert.isUndefined((ex as any).answer, "exercises must not expose the correct answer");
        }
    });

    it("exposes choices (answer + distractors) for multiple_choice exercises and hides the answer", async () => {

        const mod = makeModule();
        const mc = new Exercise({ id: "ex-mc", moduleId: "mod-1", type: "multiple_choice", prompt: "Choose", promptTranslation: "Choose", answer: "spiser", distractors: ["drikker", "løber"], vocabularyItemId: "v-1", grammarConceptId: null });
        const progress = makeProgress();

        const config = makeMockConfig(mod.toBSON(), [mc.toBSON()], progress.toBSON());
        const delegate = new StartModuleTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1", now: new Date("2026-06-11T14:00:00.000Z") }, {} as any);

        const out = result.exercises.find((e: any) => e.id === "ex-mc") as any;
        assert.isDefined(out);
        assert.isUndefined(out.answer, "answer must not be exposed");
        assert.isUndefined(out.distractors, "distractors must not be exposed alongside choices");
        assert.includeMembers(out.choices, ["spiser", "drikker", "løber"]);
        assert.lengthOf(out.choices, 3);
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
});
