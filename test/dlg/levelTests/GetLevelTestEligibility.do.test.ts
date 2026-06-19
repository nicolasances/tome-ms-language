import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetLevelTestEligibility } from "../../../src/dlg/levelTests/GetLevelTestEligibility";
import { Module } from "../../../src/model/Module";
import { User } from "../../../src/model/User";
import { UserModuleProgress } from "../../../src/model/UserModuleProgress";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModule(id: string, isUserGenerated = false): Module {
    return new Module({
        id,
        title: id,
        theme: "t",
        communicationGoal: "g",
        cefrLevel: "A1",
        vocabularyItemIds: ["v-1"],
        grammarConceptIds: [],
        isUserGenerated,
    });
}

function makeProgress(moduleId: string, status: "available" | "in_progress" | "completed"): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId,
        status,
        startedAt: "2026-06-01T09:00:00.000Z",
        completedAt: status === "completed" ? "2026-06-02T09:00:00.000Z" : null,
        testAttempts: [],
        practiceCompletedAt: null,
    });
}

/**
 * Builds a mock config wiring users, modules, userModuleProgress and levelTestAttempts.
 * `modules` respects the cefrLevel + isUserGenerated filter so curated/user-generated
 * scoping can be asserted.
 */
function makeMockConfig(opts: { user?: any; modules: Module[]; progress: UserModuleProgress[]; activeAttempt?: any | null; submittedAttempts?: any[]; }) {

    const userDoc = opts.user ?? new User({ id: "user-1", email: "u@e.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" }).toBSON();
    const moduleDocs = opts.modules.map(m => m.toBSON());
    const progressDocs = opts.progress.map(p => p.toBSON());
    const submitted = opts.submittedAttempts ?? [];

    const collections: Record<string, any> = {
        users: {
            findOne: async (f: any) => (userDoc && userDoc.id === f.id ? userDoc : null),
        },
        modules: {
            find: (filter: any) => ({
                sort: () => ({
                    toArray: async () => moduleDocs.filter(d =>
                        (filter.cefrLevel === undefined || d.cefrLevel === filter.cefrLevel) &&
                        (filter.isUserGenerated === undefined || d.isUserGenerated === filter.isUserGenerated)
                    ),
                }),
            }),
        },
        userModuleProgress: {
            find: () => ({ toArray: async () => progressDocs }),
        },
        levelTestAttempts: {
            findOne: async (f: any) => (f.takenAt === null ? (opts.activeAttempt ?? null) : null),
            find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => submitted }) }) }),
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

const NOW = new Date("2026-06-16T14:00:00.000Z");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetLevelTestEligibility.do", () => {

    it("is eligible when all curated modules at the level are completed", async () => {

        const config = makeMockConfig({
            modules: [makeModule("m1"), makeModule("m2")],
            progress: [makeProgress("m1", "completed"), makeProgress("m2", "completed")],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("is NOT eligible when a curated module is not completed", async () => {

        const config = makeMockConfig({
            modules: [makeModule("m1"), makeModule("m2")],
            progress: [makeProgress("m1", "completed"), makeProgress("m2", "in_progress")],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isString(result.reason);
    });

    it("ignores user-generated modules — eligible when only curated modules are completed", async () => {

        const config = makeMockConfig({
            // user-generated module is incomplete but must not block
            modules: [makeModule("m1"), makeModule("ug", true)],
            progress: [makeProgress("m1", "completed"), makeProgress("ug", "in_progress")],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("is NOT eligible when the level has no curated modules", async () => {

        const config = makeMockConfig({ modules: [makeModule("ug", true)], progress: [] });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
    });

    it("is NOT eligible within the 30-minute cooldown after the most recent submitted attempt", async () => {

        const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
        const config = makeMockConfig({
            modules: [makeModule("m1")],
            progress: [makeProgress("m1", "completed")],
            submittedAttempts: [{ _id: new ObjectId(), userId: "user-1", cefrLevel: "A1", takenAt: tenMinutesAgo, passed: false, startedAt: tenMinutesAgo }],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isFalse(result.eligible);
        assert.isString(result.retryAvailableAt);
        assert.isNumber(result.remainingMs);
    });

    it("is eligible once the 30-minute cooldown has elapsed", async () => {

        const fortyMinutesAgo = new Date(NOW.getTime() - 40 * 60 * 1000).toISOString();
        const config = makeMockConfig({
            modules: [makeModule("m1")],
            progress: [makeProgress("m1", "completed")],
            submittedAttempts: [{ _id: new ObjectId(), userId: "user-1", cefrLevel: "A1", takenAt: fortyMinutesAgo, passed: false, startedAt: fortyMinutesAgo }],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
    });

    it("reports an active attempt so the client can resume it (eligible, bypasses cooldown)", async () => {

        const tenMinutesAgo = new Date(NOW.getTime() - 10 * 60 * 1000).toISOString();
        const activeOid = new ObjectId();
        const config = makeMockConfig({
            modules: [makeModule("m1")],
            progress: [makeProgress("m1", "completed")],
            activeAttempt: { _id: activeOid, userId: "user-1", cefrLevel: "A1", takenAt: null, startedAt: NOW.toISOString() },
            submittedAttempts: [{ _id: new ObjectId(), userId: "user-1", cefrLevel: "A1", takenAt: tenMinutesAgo, passed: false, startedAt: tenMinutesAgo }],
        });
        const delegate = new GetLevelTestEligibility({} as any, config);

        const result = await delegate.do({ userId: "user-1", now: NOW }, {} as any);

        assert.isTrue(result.eligible);
        assert.equal(result.activeAttemptId, activeOid.toString());
    });

    it("throws 404 when the user does not exist", async () => {

        const config = makeMockConfig({ user: null, modules: [], progress: [] });
        const delegate = new GetLevelTestEligibility({} as any, config);

        try {

            await delegate.do({ userId: "ghost", now: NOW }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });
});
