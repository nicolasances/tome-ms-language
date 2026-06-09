import { assert } from "chai";
import { ObjectId } from "mongodb";
import { CompletePracticeSession } from "../../../src/dlg/practiceSessions/CompletePracticeSession";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { UserModuleProgress } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(vocabIds: string[]): Module {
    return new Module({
        id: "mod-1",
        title: "A1 Basics",
        theme: "greetings",
        communicationGoal: "greet people",
        cefrLevel: "A1",
        vocabularyItemIds: vocabIds,
        grammarConceptIds: [],
        practiceSessionSize: 4,
    });
}

function makeExerciseBSON(id: string, vocabId: string | null, grammarId: string | null = null): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: vocabId,
        grammarConceptId: grammarId,
    }).toBSON();
}

function makeSessionBSON(oid: ObjectId, exerciseIds: string[], answers: any[], overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds,
        answers,
        currentPosition: exerciseIds.length,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

function makeAnswer(exerciseId: string, isCorrect: boolean): any {
    return { exerciseId, isCorrect, userAnswer: "some-answer", answeredAt: new Date().toISOString() };
}

/**
 * Builds a mock config tracking which operations were called.
 */
function makeMockConfig(params: {
    sessionBSON: any;
    exerciseBSONs: any[];
    moduleBSON: any;
    progressBSON: any | null;
}) {

    const { sessionBSON, exerciseBSONs, moduleBSON, progressBSON } = params;

    const calls: string[] = [];
    let capturedAddToSet: any = null;
    let capturedStatusTransition: string | null = null;
    let capturedPracticeCompletedAt: string | undefined = undefined;
    let currentProgress = progressBSON ? { ...progressBSON } : null;

    const practiceSessionsCollection = {
        findOne: async (_filter: any) => sessionBSON,
        updateOne: async (_filter: any, update: any) => {
            if (update.$set?.completedAt) calls.push("complete");
            return { matchedCount: 1 };
        },
    };

    const exercisesCollection = {
        findOne: async (filter: any) => exerciseBSONs.find(e => e.id === filter.id) ?? null,
    };

    const modulesCollection = {
        findOne: async (_filter: any) => moduleBSON,
    };

    const userVocabProgressCollection = {
        find: (_filter: any) => ({ toArray: async () => [] }),
        findOne: async (_filter: any) => null,
        replaceOne: async (_filter: any, _doc: any, _opts: any) => {
            calls.push("upsertVocabProgress");
            return { upsertedCount: 1 };
        },
    };

    const userGrammarProgressCollection = {
        find: (_filter: any) => ({ toArray: async () => [] }),
        findOne: async (_filter: any) => null,
        replaceOne: async (_filter: any, _doc: any, _opts: any) => {
            calls.push("upsertGrammarProgress");
            return { upsertedCount: 1 };
        },
    };

    const userModuleProgressCollection = {
        findOne: async (_filter: any) => currentProgress,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            currentProgress = doc;
            capturedStatusTransition = doc.status;
            capturedPracticeCompletedAt = doc.practiceCompletedAt ?? undefined;
            calls.push("upsertModuleProgress");
            return { upsertedCount: 1 };
        },
        updateOne: async (_filter: any, update: any) => {
            if (update.$addToSet) {
                capturedAddToSet = update.$addToSet.vocabularyItemsPracticed.$each;
                calls.push("appendPracticedVocab");
                if (currentProgress) {
                    const toAdd = update.$addToSet.vocabularyItemsPracticed.$each as string[];
                    for (const id of toAdd) {
                        if (!currentProgress.vocabularyItemsPracticed?.includes(id)) {
                            currentProgress.vocabularyItemsPracticed = [...(currentProgress.vocabularyItemsPracticed ?? []), id];
                        }
                    }
                }
            }
            return { matchedCount: currentProgress ? 1 : 0 };
        },
    };

    const collections: Record<string, any> = {
        practiceSessions: practiceSessionsCollection,
        exercises: exercisesCollection,
        modules: modulesCollection,
        userVocabularyProgress: userVocabProgressCollection,
        userGrammarProgress: userGrammarProgressCollection,
        userModuleProgress: userModuleProgressCollection,
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        calls,
        getCapturedAddToSet: () => capturedAddToSet,
        getCapturedPracticeCompletedAt: () => capturedPracticeCompletedAt,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompletePracticeSession.do", () => {

    it("updates mastery for vocab-linked exercises", async () => {

        const oid = new ObjectId();
        const mod = makeModule(["v-1", "v-2"]);
        const exercises = [makeExerciseBSON("ex-1", "v-1"), makeExerciseBSON("ex-2", "v-2")];
        const answers = [makeAnswer("ex-1", true), makeAnswer("ex-2", false)];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], answers);
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress",
            startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
            vocabularyItemsPracticed: [],
        }).toBSON();

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: mod.toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(calls.filter(c => c === "upsertVocabProgress").length, 2);
    });

    it("appends practiced vocabulary items to UserModuleProgress", async () => {

        const oid = new ObjectId();
        const mod = makeModule(["v-1", "v-2"]);
        const exercises = [makeExerciseBSON("ex-1", "v-1"), makeExerciseBSON("ex-2", "v-2")];
        const answers = [makeAnswer("ex-1", true), makeAnswer("ex-2", true)];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], answers);
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress",
            startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
            vocabularyItemsPracticed: [],
        }).toBSON();

        const { config, calls, getCapturedAddToSet } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: mod.toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.include(calls, "appendPracticedVocab");
        const addedVocab = getCapturedAddToSet();
        assert.include(addedVocab, "v-1");
        assert.include(addedVocab, "v-2");
    });

    it("sets practiceCompletedAt and returns step2Complete=true when all vocab is covered", async () => {

        const oid = new ObjectId();
        // Module has 2 vocab items; progress already has v-1; session will add v-2 → full coverage
        const mod = makeModule(["v-1", "v-2"]);
        const exercises = [makeExerciseBSON("ex-2", "v-2")];
        const answers = [makeAnswer("ex-2", true)];
        const session = makeSessionBSON(oid, ["ex-2"], answers);
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress",
            startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
            vocabularyItemsPracticed: ["v-1"],
        }).toBSON();

        const { config, getCapturedPracticeCompletedAt } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: mod.toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isTrue(result.step2Complete);
        assert.equal(result.unseenVocabCount, 0);
        assert.isString(getCapturedPracticeCompletedAt());
    });

    it("returns step2Complete=false and unseenVocabCount>0 when coverage is not yet complete", async () => {

        const oid = new ObjectId();
        // Module has 3 vocab items; only v-1 will be practiced in this session
        const mod = makeModule(["v-1", "v-2", "v-3"]);
        const exercises = [makeExerciseBSON("ex-1", "v-1")];
        const answers = [makeAnswer("ex-1", true)];
        const session = makeSessionBSON(oid, ["ex-1"], answers);
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress",
            startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
            vocabularyItemsPracticed: [],
        }).toBSON();

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: mod.toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isFalse(result.step2Complete);
        assert.equal(result.unseenVocabCount, 2);
    });

    it("marks the session completed (sets completedAt)", async () => {

        const oid = new ObjectId();
        const mod = makeModule(["v-1"]);
        const exercises = [makeExerciseBSON("ex-1", "v-1")];
        const answers = [makeAnswer("ex-1", true)];
        const session = makeSessionBSON(oid, ["ex-1"], answers);
        const progress = new UserModuleProgress({
            userId: "user-1", moduleId: "mod-1", status: "in_progress",
            startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
            vocabularyItemsPracticed: [],
        }).toBSON();

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: mod.toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.include(calls, "complete");
    });

    it("throws 404 when the session does not exist", async () => {

        const oid = new ObjectId();
        const mod = makeModule(["v-1"]);
        const { config } = makeMockConfig({
            sessionBSON: null,
            exerciseBSONs: [],
            moduleBSON: mod.toBSON(),
            progressBSON: null,
        });

        const delegate = new CompletePracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the session is already completed", async () => {

        const oid = new ObjectId();
        const mod = makeModule(["v-1"]);
        const session = makeSessionBSON(oid, ["ex-1"], [], { completedAt: "2026-06-09T11:00:00.000Z" });
        const { config } = makeMockConfig({
            sessionBSON: session,
            exerciseBSONs: [makeExerciseBSON("ex-1", "v-1")],
            moduleBSON: mod.toBSON(),
            progressBSON: null,
        });

        const delegate = new CompletePracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
