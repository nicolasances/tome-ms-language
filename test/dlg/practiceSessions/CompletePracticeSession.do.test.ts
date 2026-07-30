import { assert } from "chai";
import { ObjectId } from "mongodb";
import { CompletePracticeSession } from "../../../src/dlg/practiceSessions/CompletePracticeSession";
import { Exercise } from "../../../src/model/Exercise";
import { Module } from "../../../src/model/Module";
import { RungCoverage, UserModuleProgress } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(vocabIds: string[], grammarIds: string[] = []): Module {
    return new Module({
        id: "mod-1",
        title: "A1 Basics",
        theme: "greetings",
        communicationGoal: "greet people",
        cefrLevel: "A1",
        vocabularyItemIds: vocabIds,
        grammarConceptIds: grammarIds,
        practiceSessionSize: 4,
    });
}

function makeExerciseBSON(id: string, type: string, vocabId: string | null, grammarId: string | null = null): any {
    return new Exercise({ id, moduleId: "mod-1", type, prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: vocabId, grammarConceptId: grammarId }).toBSON();
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

function makeProgressBSON(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): any {
    return new UserModuleProgress({
        userId: "user-1", moduleId: "mod-1", status: "in_progress",
        startedAt: "2026-06-09T09:00:00.000Z", completedAt: null, testAttempts: [],
        ...overrides,
    }).toBSON();
}

/**
 * Builds a mock config with an in-memory userModuleProgress document that honours the
 * rungCoverage positional updates the store issues, plus call tracking.
 */
function makeMockConfig(params: { sessionBSON: any; exerciseBSONs: any[]; moduleBSON: any; progressBSON: any | null; }) {

    const { sessionBSON, exerciseBSONs, moduleBSON, progressBSON } = params;

    const calls: string[] = [];
    let exerciseFindCount = 0;
    let currentProgress: any = progressBSON ? JSON.parse(JSON.stringify(progressBSON)) : null;

    const practiceSessionsCollection = {
        findOne: async (_filter: any) => sessionBSON,
        updateOne: async (_filter: any, update: any) => {
            if (update.$set?.completedAt) calls.push("complete");
            return { matchedCount: 1 };
        },
    };

    const exercisesCollection = {
        findOne: async (filter: any) => exerciseBSONs.find(e => e.id === filter.id) ?? null,
        find: (filter: any) => {
            exerciseFindCount++;
            const ids: string[] = filter.id.$in;
            return { toArray: async () => exerciseBSONs.filter(e => ids.includes(e.id)) };
        },
    };

    const modulesCollection = { findOne: async (_filter: any) => moduleBSON };

    const userVocabProgressCollection = {
        find: (_filter: any) => ({ toArray: async () => [] }),
        findOne: async (_filter: any) => null,
        replaceOne: async (_f: any, _d: any, _o: any) => { calls.push("upsertVocabProgress"); return { upsertedCount: 1 }; },
    };

    const userGrammarProgressCollection = {
        find: (_filter: any) => ({ toArray: async () => [] }),
        findOne: async (_filter: any) => null,
        replaceOne: async (_f: any, _d: any, _o: any) => { calls.push("upsertGrammarProgress"); return { upsertedCount: 1 }; },
    };

    const userModuleProgressCollection = {
        findOne: async (_filter: any) => currentProgress,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            currentProgress = doc;
            calls.push("upsertModuleProgress");
            return { upsertedCount: 1 };
        },
        updateOne: async (filter: any, update: any) => {

            if (!currentProgress) return { matchedCount: 0 };

            currentProgress.rungCoverage = currentProgress.rungCoverage ?? [];

            if (update.$addToSet?.["rungCoverage.$.itemIds"]) {

                const entry = currentProgress.rungCoverage.find((c: any) => c.rung === filter["rungCoverage.rung"]);

                if (!entry) return { matchedCount: 0 };

                calls.push("appendRungCoverage");
                for (const id of update.$addToSet["rungCoverage.$.itemIds"].$each as string[]) {
                    if (!entry.itemIds.includes(id)) entry.itemIds.push(id);
                }

                return { matchedCount: 1 };
            }

            if (update.$push?.rungCoverage) {
                calls.push("createRungCoverage");
                currentProgress.rungCoverage.push(update.$push.rungCoverage);
                return { matchedCount: 1 };
            }

            if (update.$set) {

                const elemMatch = filter.rungCoverage?.$elemMatch;
                const entry = currentProgress.rungCoverage.find((c: any) => c.rung === elemMatch.rung && c.completedAt === elemMatch.completedAt);

                if (!entry) return { matchedCount: 0 };

                calls.push("completeRung");
                for (const [key, value] of Object.entries(update.$set)) {
                    if (key === "rungCoverage.$.completedAt") entry.completedAt = value;
                    else currentProgress[key] = value;
                }

                return { matchedCount: 1 };
            }

            return { matchedCount: 1 };
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
        getProgress: () => (currentProgress ? UserModuleProgress.fromBSON(currentProgress) : null),
        getExerciseFindCount: () => exerciseFindCount,
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CompletePracticeSession.do", () => {

    it("updates mastery for vocab-linked exercises", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        // ex-2 was missed and then retried correctly — every attempt moves mastery, so 3 updates
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true), makeAnswer("ex-2", false), makeAnswer("ex-2", true)]);

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(calls.filter(c => c === "upsertVocabProgress").length, 3);
    });

    it("updates mastery for grammar-linked exercises", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "sentence_reorder", null, "g-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule([], ["g-1"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(calls.filter(c => c === "upsertGrammarProgress").length, 1);
    });

    it("fetches the session's exercises in a single bulk read rather than one query per answer", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true), makeAnswer("ex-2", true), makeAnswer("ex-1", true)]);

        const { config, getExerciseFindCount } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(getExerciseFindCount(), 1);
    });

    it("records the session's items as covered at the module's current rung", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true), makeAnswer("ex-2", true)]);

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2", "v-3"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(getProgress()!.coverageAt(1)!.itemIds, ["v-1", "v-2"]);
    });

    it("throws 400 when an exercise was answered wrong and never retried", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true), makeAnswer("ex-2", false)]);

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
            assert.deepEqual(err.outstandingExerciseIds, ["ex-2"]);
        }
    });

    it("throws 400 when an exercise was never answered at all", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true)]);

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
            assert.deepEqual(err.outstandingExerciseIds, ["ex-2"]);
        }
    });

    it("writes nothing when it rejects an unfinished session", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", false)]);

        const { config, calls, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        try { await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any); } catch { /* expected */ }

        assert.deepEqual(calls, [], "no mastery, no coverage, no session completion");
        assert.deepEqual(getProgress()!.rungCoverage, []);
    });

    it("credits an item once the retry queue produces a correct answer", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", false), makeAnswer("ex-1", true)]);

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(getProgress()!.coverageAt(1)!.itemIds, ["v-1"]);
    });

    it("credits an item whose answer was accepted by AI verification, which never flips isCorrect", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "translation_active", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", false)], { verifiedExerciseIds: ["ex-1"] });

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 3 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(getProgress()!.coverageAt(3)!.itemIds, ["v-1"]);
    });

    it("credits an item once when the session held two exercises for it", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", false), makeAnswer("ex-1", true), makeAnswer("ex-2", true)]);

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(getProgress()!.coverageAt(1)!.itemIds, ["v-1"]);
    });

    it("records every attempt against mastery, including the ones that were wrong", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", false), makeAnswer("ex-1", false), makeAnswer("ex-1", true)]);

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(calls.filter(c => c === "upsertVocabProgress").length, 3, "the two misses must still move mastery down");
    });

    it("records grammar concepts as covered alongside vocabulary items", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1"), makeExerciseBSON("ex-2", "sentence_reorder", null, "g-1")];
        const session = makeSessionBSON(oid, ["ex-1", "ex-2"], [makeAnswer("ex-1", true), makeAnswer("ex-2", true)]);

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"], ["g-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(getProgress()!.coverageAt(1)!.itemIds, ["v-1", "g-1"]);
    });

    it("completes the rung and advances to the next one when every item is covered", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-2"], [makeAnswer("ex-2", true)]);
        const progress = makeProgressBSON({ currentRung: 1, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] })] });

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isTrue(result.rungCompleted);
        assert.isFalse(result.ladderCompleted);
        assert.equal(result.currentRung, 2);
        assert.equal(result.previousRung, 1);
        assert.equal(getProgress()!.currentRung, 2);
        assert.isString(getProgress()!.coverageAt(1)!.completedAt);
    });

    it("does not complete the rung while a grammar concept is still uncovered", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"], ["g-1"]).toBSON(), progressBSON: makeProgressBSON({ currentRung: 1 }) });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isFalse(result.rungCompleted);
        assert.equal(result.currentRung, 1);
        assert.equal(getProgress()!.currentRung, 1);
    });

    it("does not set practiceCompletedAt when a rung below the last one completes", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "fill_blank", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);
        const progress = makeProgressBSON({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-08T09:00:00.000Z" })] });

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isTrue(result.rungCompleted);
        assert.isFalse(result.ladderCompleted);
        assert.equal(result.currentRung, 3);
        assert.isNull(getProgress()!.practiceCompletedAt);
    });

    it("sets practiceCompletedAt and reports the ladder complete when the last rung completes", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "translation_active", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);
        const progress = makeProgressBSON({
            currentRung: 3,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-07T09:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v-1"], completedAt: "2026-06-08T09:00:00.000Z" }),
            ],
        });

        const { config, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isTrue(result.rungCompleted);
        assert.isTrue(result.ladderCompleted);
        assert.isTrue(result.step2Complete, "step2Complete stays as the ladder-complete signal for existing clients");
        assert.equal(result.rungsCompletedAfter, 3);
        assert.isString(getProgress()!.practiceCompletedAt);
    });

    it("reports rung coverage before and after the session so the recap can animate the change", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-2", "multiple_choice", "v-2")];
        const session = makeSessionBSON(oid, ["ex-2"], [makeAnswer("ex-2", true)]);
        const progress = makeProgressBSON({ currentRung: 1, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] })] });

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2", "v-3"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(result.rungCoverageBefore, { rung: 1, coveredCount: 1, totalCount: 3 });
        assert.deepEqual(result.rungCoverageAfter, { rung: 1, coveredCount: 2, totalCount: 3 });
    });

    it("counts a grammar concept in the rung coverage total", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"], ["g-1"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(result.rungCoverageAfter.totalCount, 2);
    });

    it("reports module-wide vocabulary coverage across every rung for the recap's inner ring", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-2", "fill_blank", "v-2")];
        const session = makeSessionBSON(oid, ["ex-2"], [makeAnswer("ex-2", true)]);
        const progress = makeProgressBSON({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2", "v-3"], completedAt: "2026-06-08T09:00:00.000Z" })] });

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2", "v-3"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.deepEqual(result.vocabularyCoverage, { coveredCount: 3, totalCount: 3 });
    });

    it("reports how many rungs are complete before and after the session for the recap's outer ring", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "fill_blank", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);
        const progress = makeProgressBSON({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-08T09:00:00.000Z" })] });

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(result.rungsCompletedBefore, 1);
        assert.equal(result.rungsCompletedAfter, 2);
    });

    it("does not re-complete a rung that was already finished", async () => {

        // A "keep practising" session at rung 3 after the ladder is already done.
        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "translation_active", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);
        const progress = makeProgressBSON({
            currentRung: 3,
            practiceCompletedAt: "2026-06-09T09:00:00.000Z",
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-07T09:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v-1"], completedAt: "2026-06-08T09:00:00.000Z" }),
                new RungCoverage({ rung: 3, itemIds: ["v-1"], completedAt: "2026-06-09T09:00:00.000Z" }),
            ],
        });

        const { config, calls, getProgress } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: progress });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isFalse(result.rungCompleted, "the rung was already complete before this session");
        assert.notInclude(calls, "completeRung");
        assert.equal(getProgress()!.coverageAt(3)!.completedAt, "2026-06-09T09:00:00.000Z");
    });

    it("reports the remaining uncovered vocabulary count for clients still reading unseenVocabCount", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);

        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1", "v-2", "v-3"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.isFalse(result.step2Complete);
        assert.equal(result.unseenVocabCount, 2);
    });

    it("marks the session completed (sets completedAt)", async () => {

        const oid = new ObjectId();
        const exercises = [makeExerciseBSON("ex-1", "multiple_choice", "v-1")];
        const session = makeSessionBSON(oid, ["ex-1"], [makeAnswer("ex-1", true)]);

        const { config, calls } = makeMockConfig({ sessionBSON: session, exerciseBSONs: exercises, moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: makeProgressBSON() });
        const delegate = new CompletePracticeSession({} as any, config);

        await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.include(calls, "complete");
    });

    it("throws 404 when the session does not exist", async () => {

        const oid = new ObjectId();
        const { config } = makeMockConfig({ sessionBSON: null, exerciseBSONs: [], moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: null });
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
        const session = makeSessionBSON(oid, ["ex-1"], [], { completedAt: "2026-06-09T11:00:00.000Z" });
        const { config } = makeMockConfig({ sessionBSON: session, exerciseBSONs: [makeExerciseBSON("ex-1", "multiple_choice", "v-1")], moduleBSON: makeModule(["v-1"]).toBSON(), progressBSON: null });
        const delegate = new CompletePracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
