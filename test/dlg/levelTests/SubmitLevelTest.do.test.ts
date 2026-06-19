import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitLevelTest } from "../../../src/dlg/levelTests/SubmitLevelTest";
import { Exercise } from "../../../src/model/Exercise";
import { User } from "../../../src/model/User";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExerciseBSON(id: string, vocabId: string = "v-1"): any {
    return new Exercise({ id, moduleId: null, type: "translation_active", prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: vocabId, grammarConceptId: null }).toBSON();
}

/**
 * Builds an attempt BSON with `count` exercises, `correctCount` of which are answered correctly.
 * The remaining (count - answeredCount) are left unanswered.
 */
function makeAttemptBSON(oid: ObjectId, count: number, correctCount: number, overrides: any = {}): any {

    const exerciseIds = Array.from({ length: count }, (_, i) => `ex-${i + 1}`);
    const answeredCount = overrides.answeredCount ?? count;
    const answers = exerciseIds.slice(0, answeredCount).map((id, i) => ({ exerciseId: id, isCorrect: i < correctCount, userAnswer: "hej", answeredAt: "2026-06-16T10:00:00.000Z" }));
    delete overrides.answeredCount;

    return {
        _id: oid,
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds,
        answers,
        currentPosition: answeredCount,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-16T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[], userLevel = "A1") {

    const mutations: any[] = [];
    let current: any = attemptDoc ? { ...attemptDoc } : null;
    const userDoc = new User({ id: "user-1", email: "u@e.com", cefrLevel: userLevel as any, createdAt: "2026-01-01T00:00:00.000Z" }).toBSON();

    const collections: Record<string, any> = {
        levelTestAttempts: {
            findOne: async (f: any) => (current && current._id.equals(f._id) ? current : null),
            updateOne: async (_f: any, update: any) => { if (update.$set) Object.assign(current, update.$set); mutations.push({ op: "submitAttempt", update }); return { matchedCount: 1 }; },
        },
        exercises: { find: () => ({ toArray: async () => exerciseDocs }) },
        userVocabularyProgress: {
            findOne: async () => null,
            replaceOne: async (_f: any, doc: any) => { mutations.push({ op: "upsertVocabProgress", doc }); return { upsertedCount: 1 }; },
        },
        userGrammarProgress: { findOne: async () => null, replaceOne: async () => ({ upsertedCount: 1 }) },
        users: {
            findOne: async (f: any) => (userDoc.id === f.id ? userDoc : null),
            findOneAndUpdate: async (_f: any, update: any) => { mutations.push({ op: "advanceLevel", update }); return { ...userDoc, cefrLevel: update.$set.cefrLevel }; },
        },
    };

    return { config: { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any, mutations, getCurrent: () => current };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SubmitLevelTest.do", () => {

    it("computes a passing score (100%) when all exercises are correct", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 40, 40), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 100);
        assert.isTrue(result.passed);
    });

    it("passes at exactly 75% (threshold is inclusive)", async () => {

        const oid = new ObjectId();
        // 30 correct out of 40 = 75%
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 40, 30), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 75);
        assert.isTrue(result.passed);
    });

    it("fails below 75%", async () => {

        const oid = new ObjectId();
        // 29 correct out of 40 = 72.5% → rounds to 73
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 40, 29), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isFalse(result.passed);
    });

    it("counts unanswered exercises as wrong", async () => {

        const oid = new ObjectId();
        // 10 exercises, 8 answered all correct, 2 unanswered → 8/10 = 80%
        const exercises = Array.from({ length: 10 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config } = makeMockConfig(makeAttemptBSON(oid, 10, 8, { answeredCount: 8 }), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 80);
    });

    it("persists score, passed, and takenAt on the attempt", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, getCurrent } = makeMockConfig(makeAttemptBSON(oid, 40, 32), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const submitted = getCurrent();
        assert.isNumber(submitted.score);
        assert.isBoolean(submitted.passed);
        assert.isString(submitted.takenAt);
    });

    it("updates mastery (F06) for answered exercises", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 40, 40), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isTrue(mutations.some(m => m.op === "upsertVocabProgress"));
    });

    it("advances the user's CEFR level on a pass", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 40, 40), exercises, "A1");
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const advance = mutations.find(m => m.op === "advanceLevel");
        assert.isTrue(!!advance, "expected level advancement");
        assert.equal(advance.update.$set.cefrLevel, "A2");
        assert.equal(result.advancedTo, "A2");
    });

    it("does NOT advance the level on a fail", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 40, 10), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isFalse(!!mutations.find(m => m.op === "advanceLevel"));
        assert.isNull(result.advancedTo);
    });

    it("does not advance when already at the highest level (C2), but still passes", async () => {

        const oid = new ObjectId();
        const exercises = Array.from({ length: 40 }, (_, i) => makeExerciseBSON(`ex-${i + 1}`));
        const { config, mutations } = makeMockConfig(makeAttemptBSON(oid, 40, 40, { cefrLevel: "C2" }), exercises, "C2");
        const delegate = new SubmitLevelTest({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.isTrue(result.passed);
        assert.isNull(result.advancedTo);
        assert.isFalse(!!mutations.find(m => m.op === "advanceLevel"));
    });

    it("throws 404 when the attempt does not exist", async () => {

        const { config } = makeMockConfig(null, []);
        const delegate = new SubmitLevelTest({} as any, config);

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
        const { config } = makeMockConfig(makeAttemptBSON(oid, 5, 5, { takenAt: "2026-06-16T11:00:00.000Z" }), exercises);
        const delegate = new SubmitLevelTest({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
