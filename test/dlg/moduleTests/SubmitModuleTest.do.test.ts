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
 * Builds a completed practice session over the given exercise ids, all answered correctly.
 */
function makePracticeSessionBSON(exerciseIds: string[], overrides: any = {}): any {
    return {
        _id: new ObjectId(),
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds,
        answers: exerciseIds.map(id => ({ exerciseId: id, isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-10T10:00:00.000Z" })),
        currentPosition: exerciseIds.length,
        retryQueue: [],
        verifiedExerciseIds: [],
        startedAt: "2026-06-10T09:00:00.000Z",
        completedAt: "2026-06-10T10:00:00.000Z",
        ...overrides,
    };
}

/**
 * Matches a document against the `passNumber` / `$or` legacy-fallback filter the real stores
 * build, so these mocks exercise the same pass-scoping the production query does.
 */
function matchesPassNumberFilter(doc: any, filter: any): boolean {

    if (filter.$or) {
        return filter.$or.some((clause: any) => {
            const val = clause.passNumber;
            if (val && typeof val === "object" && "$exists" in val) return val.$exists === false ? !("passNumber" in doc) : ("passNumber" in doc);
            return doc.passNumber === val;
        });
    }

    if (filter.passNumber !== undefined) return doc.passNumber === filter.passNumber;

    return true;
}

/**
 * Builds a mock config wiring all collections needed by SubmitModuleTest.
 * Records mutations for assertion.
 *
 * `earlierAttemptDocs` are already-submitted attempts of the same user+module — what the
 * proficiency computation reads instead of the attempt being submitted now. `progressPassNumber`
 * is the passNumber on the module's progress record (F25) — it is what the proficiency
 * computation scopes its reads to.
 */
function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[], { sessionDocs = [] as any[], earlierAttemptDocs = [] as any[], progressPassNumber = 1 } = {}) {

    const mutations: any[] = [];
    let currentAttempt: any = attemptDoc ? { ...attemptDoc } : null;

    const exerciseMap = new Map(exerciseDocs.map((e: any) => [e.id, e]));

    const collections: Record<string, any> = {
        moduleTestAttempts: {
            findOne: async (filter: any, options: any = {}) => {
                if (filter._id) return currentAttempt?._id.equals(filter._id) ? currentAttempt : null;

                const submitted = [...earlierAttemptDocs, ...(currentAttempt ? [currentAttempt] : [])]
                    .filter(d => d.userId === filter.userId && d.moduleId === filter.moduleId && d.takenAt !== null && matchesPassNumberFilter(d, filter));

                if (options.sort?.takenAt === 1) submitted.sort((a, b) => a.takenAt > b.takenAt ? 1 : -1);

                return submitted[0] ?? null;
            },
            updateOne: async (_filter: any, update: any) => {
                if (!currentAttempt) return { matchedCount: 0 };
                if (update.$set) Object.assign(currentAttempt, update.$set);
                mutations.push({ op: "submitAttempt", update });
                return { matchedCount: 1 };
            },
        },
        practiceSessions: {
            find: (filter: any) => ({
                toArray: async () => sessionDocs.filter(d => {
                    if (d.userId !== filter.userId || d.moduleId !== filter.moduleId) return false;
                    if (d.completedAt === null) return false;
                    if (filter.completedAt?.$lte && d.completedAt > filter.completedAt.$lte) return false;
                    if (!matchesPassNumberFilter(d, filter)) return false;
                    return true;
                }),
            }),
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
                currentRung: 3,
                rungCoverage: [],
                practiceCompletedAt: "2026-06-01T00:00:00.000Z",
                testAttempts: [],
                passNumber: progressPassNumber,
            }),
            replaceOne: async (_f: any, doc: any) => {
                mutations.push({ op: "upsertProgress", doc });
                return { upsertedCount: 1 };
            },
            updateOne: async (_filter: any, update: any) => {
                if (update.$set?.proficiency) mutations.push({ op: "setProficiency", proficiency: update.$set.proficiency });
                else mutations.push({ op: "appendTestAttempt", update });
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

    it("computes and stores the module proficiency when the module completes", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const sessions = [makePracticeSessionBSON(["ex-1", "ex-2", "ex-3", "ex-4"])];

        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 18), exercises, { sessionDocs: sessions });
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const stored = mutations.find(m => m.op === "setProficiency");

        assert.isTrue(!!stored, "expected the proficiency to be stored on completion");
        // testScore = 100 × 18 / (18 + 3×2) = 75 ; practice is a clean rung-3 run = 100 → 0.6×75 + 0.4×100
        assert.equal(stored.proficiency.testScore, 75);
        assert.equal(stored.proficiency.practiceScore, 100);
        assert.equal(stored.proficiency.score, 85);
        assert.equal(stored.proficiency.basis, "practice-rung3-only");
    });

    it("does NOT compute a proficiency when the test fails", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));

        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 14), exercises);
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isFalse(mutations.some(m => m.op === "setProficiency"), "a failed attempt must not freeze a proficiency score");
    });

    it("scores the user's first submitted attempt, not the passing retry", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const firstFailedAttempt = makeAttemptBSON(new ObjectId(), 20, 10, { takenAt: "2026-06-10T10:00:00.000Z", score: 50, passed: false });

        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 20), exercises, { earlierAttemptDocs: [firstFailedAttempt] });
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const stored = mutations.find(m => m.op === "setProficiency");

        // The retry was flawless, but the first attempt scored 10/20 → 100 × 10 / (10 + 3×10) = 25
        assert.equal(stored.proficiency.testScore, 25);
    });

    it("scores only the record's current pass, ignoring an earlier pass's attempt and sessions (F25)", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));

        // Pass 1's attempt scored 25 (10/20 correct) and its session was a clean run — if either
        // leaked into a pass-2 score they would pull it far from the pass-2-only result asserted below.
        const passOneAttempt = makeAttemptBSON(new ObjectId(), 20, 10, { takenAt: "2026-06-01T10:00:00.000Z", score: 50, passed: false, passNumber: 1 });
        const passOneSession = makePracticeSessionBSON(["ex-1", "ex-2", "ex-3", "ex-4"], { passNumber: 1 });
        const passTwoSession = makePracticeSessionBSON(["ex-1", "ex-2", "ex-3", "ex-4"], { passNumber: 2, completedAt: "2026-07-10T10:00:00.000Z" });

        const currentAttempt = makeAttemptBSON(oid, 20, 18, { passNumber: 2 });

        const { config, mutations } = makeMockConfig(currentAttempt, exercises, {
            sessionDocs: [passOneSession, passTwoSession],
            earlierAttemptDocs: [passOneAttempt],
            progressPassNumber: 2,
        });
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const stored = mutations.find(m => m.op === "setProficiency");

        // testScore = 100 × 18 / (18 + 3×2) = 75 (the pass-2 attempt) ; practice is the pass-2 session, a clean rung-3 run = 100
        assert.equal(stored.proficiency.testScore, 75);
        assert.equal(stored.proficiency.practiceScore, 100);
        assert.equal(stored.proficiency.passNumber, 2);
    });

    it("excludes practice sessions completed after the module was completed", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 20 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const laterSession = makePracticeSessionBSON(["ex-1"], { completedAt: "2099-01-01T00:00:00.000Z" });

        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 20, 20), exercises, { sessionDocs: [laterSession] });
        const delegate = new SubmitModuleTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const stored = mutations.find(m => m.op === "setProficiency");

        assert.equal(stored.proficiency.basis, "test-only");
        assert.equal(stored.proficiency.practiceScore, null);
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
