import { assert } from "chai";
import { ObjectId } from "mongodb";
import { StartPracticeSession } from "../../../src/dlg/practiceSessions/StartPracticeSession";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { RungCoverage, UserModuleProgress } from "../../../src/model/UserModuleProgress";

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
        vocabularyItemIds: ["v-1", "v-2", "v-3", "v-4"],
        grammarConceptIds: [],
        practiceSessionSize: 4,
        ...overrides,
    });
}

function makeExercise(id: string, type: string, vocabId: string): Exercise {
    return new Exercise({ id, moduleId: "mod-1", type, prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: vocabId, grammarConceptId: null });
}

function makeGrammarExercise(id: string, type: string, grammarId: string): Exercise {
    return new Exercise({ id, moduleId: "mod-1", type, prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: null, grammarConceptId: grammarId });
}

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "available",
        startedAt: null,
        completedAt: null,
        testAttempts: [],
        ...overrides,
    });
}

/**
 * Builds a minimal mock config. Collections:
 *  - modules: returns moduleDoc on findOne
 *  - exercises: returns exerciseDocs on find
 *  - userModuleProgress: returns progressDoc on findOne, replaceOne is a no-op
 *  - userVocabularyProgress / userGrammarProgress: return [] on find (no mastery yet)
 *  - practiceSessions: returns null on findOne (no active session), returns insertedId on insertOne
 */
function makeMockConfig(moduleBSON: any, exerciseBSONs: any[], progressBSON: any | null) {

    const insertedId = new ObjectId();

    const collections: Record<string, any> = {
        modules: {
            findOne: async (filter: any) => (moduleBSON.id === filter.id ? moduleBSON : null),
        },
        exercises: {
            find: (_filter: any) => ({ toArray: async () => exerciseBSONs }),
        },
        userModuleProgress: {
            findOne: async (_filter: any) => progressBSON,
            replaceOne: async (_filter: any, _doc: any, _opts: any) => ({ upsertedCount: 1 }),
        },
        userVocabularyProgress: {
            find: (_filter: any) => ({ toArray: async () => [] }),
        },
        userGrammarProgress: {
            find: (_filter: any) => ({ toArray: async () => [] }),
        },
        practiceSessions: {
            findOne: async (_filter: any) => null,
            insertOne: async (_doc: any) => ({ insertedId }),
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

describe("StartPracticeSession.do", () => {

    it("returns a session with exerciseIds set and startedAt populated", async () => {

        const mod = makeModule();
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-mc-2", "multiple_choice", "v-2"),
            makeExercise("ex-mc-3", "multiple_choice", "v-3"),
            makeExercise("ex-mc-4", "multiple_choice", "v-4"),
        ];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress().toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isString(result.sessionId);
        assert.isArray(result.exercises);
        assert.isAbove(result.exercises.length, 0);
        assert.isString(result.startedAt);
    });

    it("reports the rung the session is being drawn at", async () => {

        const mod = makeModule();
        const exercises = [makeExercise("ex-fb-1", "fill_blank", "v-1"), makeExercise("ex-fb-2", "fill_blank", "v-2")];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress({ currentRung: 2 }).toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.equal(result.currentRung, 2);
    });

    it("draws only rung-1 exercises, ignoring the rest of the bank", async () => {

        // Deliberately undersized fixture: only 2 of the 4 exercises are rung 1, against a session
        // size of 4. A real bank cannot look like this — the generation floor puts >=1 exercise per
        // item at every rung, so the rung pool always exceeds practiceSessionSize. Here the session
        // is 2 exercises, which pins down that the filter drops the off-rung ones outright rather
        // than falling back to them to fill the session.
        const mod = makeModule({ practiceSessionSize: 4 });
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-mc-2", "multiple_choice", "v-2"),
            makeExercise("ex-fb-1", "fill_blank", "v-3"),
            makeExercise("ex-ta-1", "translation_active", "v-4"),
        ];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress({ currentRung: 1 }).toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.deepEqual(result.exercises.map(e => e.id).sort(), ["ex-mc-1", "ex-mc-2"]);
    });

    it("draws only rung-2 exercises once the module has advanced to rung 2", async () => {

        const mod = makeModule({ practiceSessionSize: 4 });
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-fb-1", "fill_blank", "v-2"),
            makeExercise("ex-cd-1", "conjugation_drill", "v-3"),
            makeExercise("ex-ta-1", "translation_active", "v-4"),
        ];

        const progress = makeProgress({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2", "v-3", "v-4"], completedAt: "2026-06-02T09:00:00.000Z" })] });
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isNotEmpty(result.exercises);
        for (const ex of result.exercises) assert.include(["fill_blank", "conjugation_drill"], ex.type);
    });

    it("draws only rung-3 exercises once the module has advanced to rung 3", async () => {

        const mod = makeModule({ practiceSessionSize: 4 });
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-fb-1", "fill_blank", "v-2"),
            makeExercise("ex-ta-1", "translation_active", "v-3"),
            makeGrammarExercise("ex-ec-1", "error_correction", "g-1"),
        ];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress({ currentRung: 3 }).toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isNotEmpty(result.exercises);
        for (const ex of result.exercises) assert.include(["translation_active", "error_correction"], ex.type);
    });

    it("treats an item covered at rung 1 as still uncovered at rung 2", async () => {

        // v-1 is covered at rung 1 but not at rung 2, so its rung-2 exercise must be reserved.
        const mod = makeModule({ vocabularyItemIds: ["v-1", "v-2"], practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-fb-1", "fill_blank", "v-1"), makeExercise("ex-fb-2", "fill_blank", "v-2")];

        const progress = makeProgress({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"], completedAt: "2026-06-02T09:00:00.000Z" })] });
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.deepEqual(result.exercises.map(e => e.id).sort(), ["ex-fb-1", "ex-fb-2"]);
    });

    it("reserves the unseen slots for grammar concepts as well as vocabulary items", async () => {

        const mod = makeModule({ vocabularyItemIds: ["v-1"], grammarConceptIds: ["g-1"], practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1"), makeGrammarExercise("ex-sr-1", "sentence_reorder", "g-1")];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress().toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.deepEqual(result.exercises.map(e => e.id).sort(), ["ex-mc-1", "ex-sr-1"]);
    });

    it("prioritises items not yet covered at the current rung over already-covered ones", async () => {

        // v-1 and v-2 are already covered at rung 1; v-3 and v-4 are not. Session size 2, so the
        // 50% floor reserves at least 1 slot for the uncovered items.
        const mod = makeModule({ vocabularyItemIds: ["v-1", "v-2", "v-3", "v-4"], practiceSessionSize: 2 });
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-mc-2", "multiple_choice", "v-2"),
            makeExercise("ex-mc-3", "multiple_choice", "v-3"),
            makeExercise("ex-mc-4", "multiple_choice", "v-4"),
        ];

        const progress = makeProgress({ currentRung: 1, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"] })] });
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        const uncoveredSelected = result.exercises.filter(e => ["v-3", "v-4"].includes(e.vocabularyItemId!));

        assert.isAtLeast(uncoveredSelected.length, 1, "at least half the session must go to items not yet covered at this rung");
    });

    it("fills the whole session even when fewer uncovered items remain than the session size (no tail top-up)", async () => {

        // Only v-4 is left uncovered at rung 1, but the session is still a full 4 exercises.
        const mod = makeModule({ vocabularyItemIds: ["v-1", "v-2", "v-3", "v-4"], practiceSessionSize: 4 });
        const exercises = [
            makeExercise("ex-mc-1", "multiple_choice", "v-1"),
            makeExercise("ex-mc-2", "multiple_choice", "v-2"),
            makeExercise("ex-mc-3", "multiple_choice", "v-3"),
            makeExercise("ex-mc-4", "multiple_choice", "v-4"),
        ];

        const progress = makeProgress({ currentRung: 1, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2", "v-3"] })] });
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.lengthOf(result.exercises, 4);
        assert.include(result.exercises.map(e => e.id), "ex-mc-4", "the last uncovered item must be in the session so the rung can complete");
    });

    it("throws 400 when the bank holds no exercise at the module's current rung", async () => {

        const mod = makeModule({ practiceSessionSize: 4 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1")];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress({ currentRung: 2 }).toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);
            assert.fail("Expected a 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
            assert.match(err.message, /rung 2/i);
        }
    });

    it("starts a module with no progress record at the first rung", async () => {

        const mod = makeModule({ practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1"), makeExercise("ex-ta-1", "translation_active", "v-2")];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), null);
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.equal(result.currentRung, 1);
        assert.deepEqual(result.exercises.map(e => e.id), ["ex-mc-1"]);
    });

    it("leaves a completed module completed when the user re-practises it", async () => {

        // "Keep practising" on a module whose test was already passed. Starting the session
        // transitions to in_progress, which must not un-complete the module — F21 gates the level
        // test on every module at the level being completed.
        const mod = makeModule({ practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-ta-1", "translation_active", "v-1"), makeExercise("ex-ta-2", "translation_active", "v-2")];
        const progress = makeProgress({ status: "completed", completedAt: "2026-06-05T10:00:00.000Z", currentRung: 3 });

        let storedStatus: string | null = null;

        const collections: Record<string, any> = {
            modules: { findOne: async () => mod.toBSON() },
            exercises: { find: () => ({ toArray: async () => exercises.map(e => e.toBSON()) }) },
            userModuleProgress: {
                findOne: async () => progress.toBSON(),
                replaceOne: async (_f: any, doc: any) => { storedStatus = doc.status; return { upsertedCount: 1 }; },
            },
            userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
            userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
            practiceSessions: { findOne: async () => null, insertOne: async () => ({ insertedId: new ObjectId() }) },
        };

        const config = { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any;
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isNotEmpty(result.exercises, "the session still starts — re-practising a completed module is allowed");
        assert.equal(storedStatus, "completed", "the module must not be knocked back to in_progress");
    });

    it("stamps the new session with the progress record's passNumber (F25)", async () => {

        const mod = makeModule({ practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1"), makeExercise("ex-ta-1", "translation_active", "v-2")];
        const progress = makeProgress({ passNumber: 2 });

        let insertedDoc: any = null;
        const insertedId = new ObjectId();

        const collections: Record<string, any> = {
            modules: { findOne: async () => mod.toBSON() },
            exercises: { find: () => ({ toArray: async () => exercises.map(e => e.toBSON()) }) },
            userModuleProgress: { findOne: async () => progress.toBSON(), replaceOne: async () => ({ upsertedCount: 1 }) },
            userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
            userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
            practiceSessions: {
                findOne: async () => null,
                insertOne: async (doc: any) => { insertedDoc = doc; return { insertedId }; },
            },
        };

        const config = { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any;
        const delegate = new StartPracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.equal(insertedDoc.passNumber, 2);
    });

    it("stamps a new session with passNumber 1 when no progress record exists yet", async () => {

        const mod = makeModule({ practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1"), makeExercise("ex-ta-1", "translation_active", "v-2")];

        let insertedDoc: any = null;
        const insertedId = new ObjectId();

        const collections: Record<string, any> = {
            modules: { findOne: async () => mod.toBSON() },
            exercises: { find: () => ({ toArray: async () => exercises.map(e => e.toBSON()) }) },
            userModuleProgress: { findOne: async () => null, replaceOne: async () => ({ upsertedCount: 1 }) },
            userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
            userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
            practiceSessions: {
                findOne: async () => null,
                insertOne: async (doc: any) => { insertedDoc = doc; return { insertedId }; },
            },
        };

        const config = { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any;
        const delegate = new StartPracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.equal(insertedDoc.passNumber, 1);
    });

    it("throws 409 when an active session already exists for this user+module", async () => {

        const mod = makeModule();
        const exercises = [makeExercise("ex-1", "multiple_choice", "v-1")];

        const activeSessionBSON = {
            _id: new ObjectId(),
            userId: "user-1",
            moduleId: "mod-1",
            exerciseIds: ["ex-1"],
            answers: [],
            currentPosition: 0,
            retryQueue: [],
            startedAt: new Date().toISOString(),
            completedAt: null,
        };

        const insertedId = new ObjectId();
        const collections: Record<string, any> = {
            modules: { findOne: async () => mod.toBSON() },
            exercises: { find: () => ({ toArray: async () => exercises.map(e => e.toBSON()) }) },
            userModuleProgress: {
                findOne: async () => makeProgress().toBSON(),
                replaceOne: async () => ({ upsertedCount: 1 }),
            },
            userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
            userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
            practiceSessions: {
                findOne: async () => activeSessionBSON,
                insertOne: async () => ({ insertedId }),
            },
        };

        const config = {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any;

        const delegate = new StartPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);
            assert.fail("Expected 409 error");

        } catch (err: any) {

            assert.equal(err.code, 409);
            assert.equal(err.sessionId, activeSessionBSON._id.toString());
        }
    });

    it("throws 404 when the module is not found", async () => {

        const collections: Record<string, any> = {
            modules: { findOne: async () => null },
            exercises: { find: () => ({ toArray: async () => [] }) },
            userModuleProgress: { findOne: async () => null, replaceOne: async () => ({}) },
            userVocabularyProgress: { find: () => ({ toArray: async () => [] }) },
            userGrammarProgress: { find: () => ({ toArray: async () => [] }) },
            practiceSessions: { findOne: async () => null, insertOne: async () => ({ insertedId: new ObjectId() }) },
        };

        const config = {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any;

        const delegate = new StartPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "non-existent" }, { userId: "user-1" } as any);
            assert.fail("Expected 404 error");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("embeds full exercise objects (id, type, prompt, answer) in the exercises field", async () => {

        const mod = makeModule({ practiceSessionSize: 2 });
        const exercises = [makeExercise("ex-mc-1", "multiple_choice", "v-1"), makeExercise("ex-mc-2", "multiple_choice", "v-2")];

        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), makeProgress().toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isArray(result.exercises);
        assert.isAbove(result.exercises.length, 0);

        for (const ex of result.exercises) {
            assert.isString(ex.id, "exercise must have an id");
            assert.isString(ex.type, "exercise must have a type");
            assert.isString(ex.prompt, "exercise must have a prompt");
            assert.isString(ex.answer, "exercise must have an answer");
        }
    });
});
