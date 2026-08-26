import { assert } from "chai";
import { ObjectId } from "mongodb";
import { RePracticeModule } from "../../../src/dlg/moduleProgress/RePracticeModule";
import { ModuleProficiency, TestAttemptRecord, UserModuleProgress } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompletedProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "completed",
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: "2026-06-05T10:00:00.000Z",
        currentRung: 3,
        practiceCompletedAt: "2026-06-04T09:00:00.000Z",
        testAttempts: [new TestAttemptRecord({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-05T09:00:00.000Z" })],
        proficiency: new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-06-05T10:00:00.000Z", version: 1 }),
        ...overrides,
    });
}

/**
 * Builds a mock config for RePracticeModule.do. Collections:
 *  - userModuleProgress: returns progressBSON on findOne; updateOne mutates the in-memory doc
 *  - practiceSessions: returns activeSessionBSON on findOne (null when none)
 *  - moduleTestAttempts: returns activeAttemptBSON on findOne (null when none)
 */
function makeMockConfig(progressBSON: any | null, activeSessionBSON: any | null = null, activeAttemptBSON: any | null = null) {

    const docs = progressBSON ? [progressBSON] : [];

    const collections: Record<string, any> = {
        userModuleProgress: {
            findOne: async (filter: any) => docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
            updateOne: async (filter: any, update: any) => {
                const idx = docs.findIndex(d => d.userId === filter.userId && d.moduleId === filter.moduleId);
                if (idx < 0) return { matchedCount: 0 };
                docs[idx] = { ...docs[idx], ...update.$set };
                return { matchedCount: 1 };
            },
        },
        practiceSessions: {
            findOne: async () => activeSessionBSON,
        },
        moduleTestAttempts: {
            findOne: async () => activeAttemptBSON,
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

describe("RePracticeModule.do", () => {

    it("resets a completed, quiet module to available and increments passNumber", async () => {

        const progress = makeCompletedProgress();
        const config = makeMockConfig(progress.toBSON());
        const delegate = new RePracticeModule({} as any, config);

        const result = await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);

        assert.equal(result.moduleId, "mod-1");
        assert.equal(result.status, "available");
        assert.equal(result.passNumber, 2);
        assert.isNull(result.startedAt);
        assert.isNull(result.completedAt);
        assert.isNull(result.practiceCompletedAt);
        assert.equal(result.currentRung, 1);
    });

    it("throws 404 when no progress record exists for the user + module", async () => {

        const config = makeMockConfig(null);
        const delegate = new RePracticeModule({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);
            assert.fail("Expected 404 error");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the module's status is not completed", async () => {

        const progress = makeCompletedProgress({ status: "in_progress" });
        const config = makeMockConfig(progress.toBSON());
        const delegate = new RePracticeModule({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);
            assert.fail("Expected 400 error");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 409 with sessionId when an active practice session is open", async () => {

        const progress = makeCompletedProgress();
        const activeSessionOid = new ObjectId();
        const activeSessionBSON = {
            _id: activeSessionOid, userId: "user-1", moduleId: "mod-1", exerciseIds: [], answers: [],
            currentPosition: 0, retryQueue: [], startedAt: "2026-06-06T09:00:00.000Z", completedAt: null,
        };

        const config = makeMockConfig(progress.toBSON(), activeSessionBSON);
        const delegate = new RePracticeModule({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);
            assert.fail("Expected 409 error");

        } catch (err: any) {

            assert.equal(err.code, 409);
            assert.equal(err.sessionId, activeSessionOid.toString());
        }
    });

    it("throws 409 with attemptId when an active test attempt is open", async () => {

        const progress = makeCompletedProgress();
        const activeAttemptOid = new ObjectId();
        const activeAttemptBSON = {
            _id: activeAttemptOid, userId: "user-1", moduleId: "mod-1", exerciseIds: [], answers: [],
            currentPosition: 0, verifiedExerciseIds: [], score: null, passed: null,
            startedAt: "2026-06-06T09:00:00.000Z", takenAt: null, exerciseResults: [],
        };

        const config = makeMockConfig(progress.toBSON(), null, activeAttemptBSON);
        const delegate = new RePracticeModule({} as any, config);

        try {

            await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);
            assert.fail("Expected 409 error");

        } catch (err: any) {

            assert.equal(err.code, 409);
            assert.equal(err.attemptId, activeAttemptOid.toString());
        }
    });

    it("preserves testAttempts and proficiency on the underlying record across the reset", async () => {

        const progress = makeCompletedProgress();
        const config = makeMockConfig(progress.toBSON());
        const delegate = new RePracticeModule({} as any, config);

        await delegate.do({ userId: "user-1", moduleId: "mod-1" }, {} as any);

        const db = await config.getMongoDb();
        const stored = await db.collection("userModuleProgress").findOne({ userId: "user-1", moduleId: "mod-1" });

        assert.equal(stored.testAttempts.length, 1, "testAttempts must survive the reset");
        assert.isNotNull(stored.proficiency, "proficiency must survive the reset");
    });
});
