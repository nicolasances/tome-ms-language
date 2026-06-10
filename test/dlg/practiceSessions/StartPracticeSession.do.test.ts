import { assert } from "chai";
import { ObjectId } from "mongodb";
import { StartPracticeSession } from "../../../src/dlg/practiceSessions/StartPracticeSession";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { PracticeSession } from "../../../src/model/PracticeSession";
import { UserModuleProgress } from "../../../src/model/UserModuleProgress";

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
    return new Exercise({
        id,
        moduleId: "mod-1",
        type,
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: vocabId,
        grammarConceptId: null,
    });
}

function makeProgress(vocabPracticed: string[] = []): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "available",
        startedAt: null,
        completedAt: null,
        vocabularyItemsPracticed: vocabPracticed,
        testAttempts: [],
    });
}

/**
 * Builds a minimal mock config. Collections:
 *  - modules: returns moduleDoc on findOne
 *  - exercises: returns exerciseDocs on find
 *  - userModuleProgress: returns progressDoc on findOne, replaceOne is a no-op
 *  - userVocabularyProgress: returns [] on find (no mastery yet)
 *  - userGrammarProgress: returns [] on find
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
            makeExercise("ex-t-1", "translation_active", "v-3"),
            makeExercise("ex-t-2", "translation_active", "v-4"),
        ];

        const progress = makeProgress([]);
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        assert.isString(result.sessionId);
        assert.isArray(result.exerciseIds);
        assert.isAbove(result.exerciseIds.length, 0);
        assert.isString(result.startedAt);
    });

    it("orders selected exercises by the type progression (multiple_choice before translation_active)", async () => {

        const mod = makeModule({ practiceSessionSize: 4 });
        // Build 2 translation exercises and 2 multiple_choice exercises for 4 distinct vocab items
        const exercises = [
            makeExercise("ex-t-1", "translation_active", "v-1"),
            makeExercise("ex-t-2", "translation_active", "v-2"),
            makeExercise("ex-mc-1", "multiple_choice", "v-3"),
            makeExercise("ex-mc-2", "multiple_choice", "v-4"),
        ];

        const progress = makeProgress([]);
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        // Multiple_choice exercises must appear before translation_active
        const positions = result.exerciseIds.map((id: string) => {
            const ex = exercises.find(e => e.id === id)!;
            return ex.type;
        });
        const mcIndex = positions.indexOf("multiple_choice");
        const tIndex = positions.indexOf("translation_active");

        if (mcIndex !== -1 && tIndex !== -1) assert.isBelow(mcIndex, tIndex);
    });

    it("throws 409 when an active session already exists for this user+module", async () => {

        const mod = makeModule();
        const exercises = [makeExercise("ex-1", "translation_active", "v-1")];
        const progress = makeProgress([]);

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
                findOne: async () => progress.toBSON(),
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

    it("reserves unseen-vocab exercises when coverage is not yet complete", async () => {

        // 4 vocab items, none practiced yet. Session size 4.
        // All 4 exercises link to unseen vocab — all must be selected.
        const mod = makeModule({ vocabularyItemIds: ["v-1", "v-2", "v-3", "v-4"], practiceSessionSize: 4 });
        const exercises = [
            makeExercise("ex-1", "translation_active", "v-1"),
            makeExercise("ex-2", "translation_active", "v-2"),
            makeExercise("ex-3", "translation_active", "v-3"),
            makeExercise("ex-4", "translation_active", "v-4"),
        ];

        const progress = makeProgress([]); // nothing practiced yet
        const config = makeMockConfig(mod.toBSON(), exercises.map(e => e.toBSON()), progress.toBSON());
        const delegate = new StartPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, { userId: "user-1" } as any);

        // All selected exercises must target unseen vocab (v-1..v-4, none practiced)
        assert.lengthOf(result.exerciseIds, 4);
        for (const id of result.exerciseIds) {
            const ex = exercises.find(e => e.id === id)!;
            assert.include(["v-1", "v-2", "v-3", "v-4"], ex.vocabularyItemId);
        }
    });
});
