import { assert } from "chai";
import { ObjectId } from "mongodb";
import { StartLevelTest } from "../../../src/dlg/levelTests/StartLevelTest";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { User } from "../../../src/model/User";
import { UserModuleProgress } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(id: string, isUserGenerated = false): Module {
    return new Module({ id, title: id, theme: "t", communicationGoal: "g", cefrLevel: "A1", vocabularyItemIds: ["v-1"], grammarConceptIds: [], isUserGenerated });
}

function makeProgress(moduleId: string, status: "in_progress" | "completed"): UserModuleProgress {
    return new UserModuleProgress({ userId: "user-1", moduleId, status, startedAt: "2026-06-01T09:00:00.000Z", completedAt: null, testAttempts: [], practiceCompletedAt: null });
}

function makeExercise(id: string, vocabId: string): Exercise {
    return new Exercise({ id, moduleId: null, type: "translation_active", prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: vocabId, grammarConceptId: null });
}

/**
 * Builds a bank exercise pool of `n` exercises spread across `vocabCount` vocab items
 * (so the dedup-by-item draw has enough distinct items to reach 40).
 */
function makeBankPool(n: number, vocabCount: number): Exercise[] {
    return Array.from({ length: n }, (_, i) => makeExercise(`ex-${i + 1}`, `v-${i % vocabCount}`));
}

interface MockOpts {
    user?: any;
    modules?: Module[];
    progress?: UserModuleProgress[];
    bank?: any | null;            // levelTestBank doc, or null for 404
    exercises?: Exercise[];
    activeAttempt?: any | null;
    submittedAttempts?: any[];
}

function makeMockConfig(opts: MockOpts) {

    const userDoc = opts.user === undefined ? new User({ id: "user-1", email: "u@e.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" }).toBSON() : opts.user;
    const moduleDocs = (opts.modules ?? [makeModule("m1")]).map(m => m.toBSON());
    const progressDocs = (opts.progress ?? [makeProgress("m1", "completed")]).map(p => p.toBSON());
    const exerciseDocs = (opts.exercises ?? []).map(e => e.toBSON());
    const exerciseMap = new Map(exerciseDocs.map((e: any) => [e.id, e]));
    const insertedOid = new ObjectId();

    let createdAttempt: any = null;

    const collections: Record<string, any> = {
        users: { findOne: async (f: any) => (userDoc && userDoc.id === f.id ? userDoc : null) },
        modules: {
            find: (filter: any) => ({ sort: () => ({ toArray: async () => moduleDocs.filter(d =>
                (filter.cefrLevel === undefined || d.cefrLevel === filter.cefrLevel) &&
                (filter.isUserGenerated === undefined || d.isUserGenerated === filter.isUserGenerated)) }) }),
        },
        userModuleProgress: { find: () => ({ toArray: async () => progressDocs }) },
        levelTestBanks: { findOne: async () => (opts.bank === undefined ? { id: "bank-A1", cefrLevel: "A1", exerciseIds: exerciseDocs.map((e: any) => e.id), generatedAt: "2026-01-01", totalGenerated: exerciseDocs.length } : opts.bank) },
        exercises: {
            find: (filter: any) => {
                const ids: string[] = filter?.id?.$in ?? [];
                return { toArray: async () => ids.map(id => exerciseMap.get(id)).filter(Boolean) };
            },
        },
        userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
        userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
        levelTestAttempts: {
            findOne: async (f: any) => (f.takenAt === null ? (opts.activeAttempt ?? null) : null),
            find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => opts.submittedAttempts ?? [] }) }) }),
            insertOne: async (doc: any) => { createdAttempt = doc; return { insertedId: insertedOid }; },
        },
    };

    return {
        config: { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any,
        getCreatedAttempt: () => createdAttempt,
        insertedOid,
    };
}

const NOW = new Date("2026-06-16T14:00:00.000Z");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("StartLevelTest.do", () => {

    it("draws exactly 40 exercises from the level bank and returns full exercise objects", async () => {

        const { config } = makeMockConfig({ exercises: makeBankPool(60, 60) });
        const delegate = new StartLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isString(result.attemptId);
        assert.equal(result.cefrLevel, "A1");
        assert.equal(result.exercises.length, 40);
        for (const ex of result.exercises) assert.isString((ex as any).answer);
    });

    it("persists the attempt with cefrLevel and the selected exerciseIds", async () => {

        const { config, getCreatedAttempt } = makeMockConfig({ exercises: makeBankPool(60, 60) });
        const delegate = new StartLevelTest({} as any, config);

        await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        const created = getCreatedAttempt();
        assert.equal(created.cefrLevel, "A1");
        assert.equal(created.exerciseIds.length, 40);
        assert.equal(created.takenAt, null);
        assert.equal(created.currentPosition, 0);
    });

    it("throws 409 with the existing attemptId when an active attempt already exists", async () => {

        const existingOid = new ObjectId();
        const { config } = makeMockConfig({
            exercises: makeBankPool(60, 60),
            activeAttempt: { _id: existingOid, userId: "user-1", cefrLevel: "A1", takenAt: null, startedAt: NOW.toISOString(), exerciseIds: [], answers: [], currentPosition: 0, verifiedExerciseIds: [], score: null, passed: null, exerciseResults: [] },
        });
        const delegate = new StartLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", now: NOW }, {} as any);
            assert.fail("Expected 409");

        } catch (err: any) {

            assert.equal(err.code, 409);
            assert.equal(err.attemptId, existingOid.toString());
        }
    });

    it("throws 400 when not all curated modules are completed", async () => {

        const { config } = makeMockConfig({
            modules: [makeModule("m1"), makeModule("m2")],
            progress: [makeProgress("m1", "completed"), makeProgress("m2", "in_progress")],
            exercises: makeBankPool(60, 60),
        });
        const delegate = new StartLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", now: NOW }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the 30-minute cooldown has not elapsed", async () => {

        const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
        const { config } = makeMockConfig({
            exercises: makeBankPool(60, 60),
            submittedAttempts: [{ _id: new ObjectId(), userId: "user-1", cefrLevel: "A1", takenAt: tenMinutesAgo, passed: false, startedAt: tenMinutesAgo }],
        });
        const delegate = new StartLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", now: NOW }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("allows starting once the cooldown has elapsed", async () => {

        const fortyMinutesAgo = new Date(NOW.getTime() - 40 * 60 * 1000).toISOString();
        const { config } = makeMockConfig({
            exercises: makeBankPool(60, 60),
            submittedAttempts: [{ _id: new ObjectId(), userId: "user-1", cefrLevel: "A1", takenAt: fortyMinutesAgo, passed: false, startedAt: fortyMinutesAgo }],
        });
        const delegate = new StartLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.equal(result.exercises.length, 40);
    });

    it("throws 404 when no level test bank exists for the user's level", async () => {

        const { config } = makeMockConfig({ bank: null, exercises: makeBankPool(60, 60) });
        const delegate = new StartLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", now: NOW }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 404 when the user does not exist", async () => {

        const { config } = makeMockConfig({ user: null });
        const delegate = new StartLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "ghost", now: NOW }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });
});
