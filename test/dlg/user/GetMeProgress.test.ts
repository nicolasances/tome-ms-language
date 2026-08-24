import { assert } from "chai";
import { Request } from "express";
import { User } from "../../../src/model/User";
import { Module } from "../../../src/model/Module";
import { ModuleProficiency, UserModuleProgress, RungCoverage, TestAttemptRecord } from "../../../src/model/UserModuleProgress";
import { GetMeProgress } from "../../../src/dlg/user/GetMeProgress";
import { Exercise } from "../../../src/model/Exercise";
import { PROFICIENCY_VERSION } from "../../../src/Config";
import { ObjectId } from "mongodb";

const userContext = { email: "alice@example.com", userId: "u1", authProvider: "test" };

function makeUser(cefrLevel = "A1") {
    return new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: cefrLevel as any, createdAt: "2026-01-01T00:00:00.000Z" });
}

function makeModule(id: string, cefrLevel = "A1", vocabularyItemIds: string[] = [], overrides: Partial<{ testRetryDelayMinutes: number; testUnlockDelayHours: number }> = {}) {
    return new Module({
        id, title: `Module ${id}`, theme: "T", communicationGoal: "G",
        cefrLevel: cefrLevel as any, vocabularyItemIds, grammarConceptIds: [],
        isUserGenerated: false, ...overrides,
    });
}

function makeProgress(moduleId: string, status: string, overrides: Partial<{
    startedAt: string | null;
    completedAt: string | null;
    practiceCompletedAt: string | null;
    testAttempts: TestAttemptRecord[];
    currentRung: number;
    rungCoverage: RungCoverage[];
    passNumber: number;
}> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "uuid-001", moduleId, status: status as any,
        startedAt: null, completedAt: null, testAttempts: [],
        ...overrides,
    });
}

function makeAttempt(passed: boolean, takenAt: string): TestAttemptRecord {
    return new TestAttemptRecord({ id: "att-1", score: passed ? 90 : 50, passed, takenAt });
}

/**
 * Builds a mock config with in-memory collections.
 * The modules mock returns ALL docs regardless of filter (GetMeProgress calls list() with no cefrLevel filter).
 */
function makeMockConfig(userDocs: any[], moduleDocs: any[], progressDocs: any[]) {
    const userCol = {
        findOne: async (filter: any) => userDocs.find(d => d.email === filter.email) ?? null,
    };
    const moduleCol = {
        find: (_filter: any) => ({
            sort: (_s: any) => ({
                toArray: async () => moduleDocs,
            }),
        }),
    };
    const progressCol = {
        find: (filter: any) => ({
            toArray: async () => progressDocs.filter(d => {
                if (d.userId !== filter.userId) return false;
                if (filter.moduleId?.$in && !filter.moduleId.$in.includes(d.moduleId)) return false;
                return true;
            }),
        }),
        updateOne: async (_filter: any, _update: any) => ({ matchedCount: 1 }),
    };
    // Empty proficiency inputs: the lazy backfill finds no submitted test attempt and stays a no-op.
    const emptyCol = {
        findOne: async () => null,
        find: (_filter: any) => ({ toArray: async () => [] }),
    };
    return {
        getDBName: () => "test",
        getMongoDb: async () => ({
            collection: (name: string) => {
                if (name === "users") return userCol;
                if (name === "modules") return moduleCol;
                if (name === "userModuleProgress") return progressCol;
                return emptyCol;
            },
        }),
    } as any;
}

describe("GetMeProgress.parseRequest", () => {

    it("returns no cefrLevel when no query param is given", () => {
        const delegate = new GetMeProgress({} as any, {} as any);
        const parsed = delegate.parseRequest({ params: {}, query: {}, body: {} } as unknown as Request);

        assert.isUndefined(parsed.cefrLevel);
    });

    it("parses cefrLevel from the query string", () => {
        const delegate = new GetMeProgress({} as any, {} as any);
        const parsed = delegate.parseRequest({ params: {}, query: { cefrLevel: "B1" }, body: {} } as unknown as Request);

        assert.equal(parsed.cefrLevel, "B1");
    });
});

describe("GetMeProgress.do - currentCefrLevel", () => {

    it("returns the user's current CEFR level", async () => {
        const config = makeMockConfig([makeUser("A2").toBSON()], [], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.currentCefrLevel, "A2");
    });

    it("throws 404 when the user profile is not found", async () => {
        const config = makeMockConfig([], [], []);
        const delegate = new GetMeProgress({} as any, config);

        try {
            await delegate.do({}, userContext);
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});


describe("GetMeProgress.do - levels rollup", () => {

    it("returns exactly 6 level entries covering A1 through C2", async () => {
        const config = makeMockConfig([makeUser("A1").toBSON()], [], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.levels.length, 6);
        assert.deepEqual(result.levels.map(l => l.level), ["A1", "A2", "B1", "B2", "C1", "C2"]);
    });

    it("marks the user's active level as 'current'", async () => {
        const config = makeMockConfig([makeUser("B1").toBSON()], [], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        const b1 = result.levels.find(l => l.level === "B1")!;
        assert.equal(b1.status, "current");
    });

    it("marks all levels below the user's level as 'completed'", async () => {
        const config = makeMockConfig([makeUser("B1").toBSON()], [], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.levels.find(l => l.level === "A1")!.status, "completed");
        assert.equal(result.levels.find(l => l.level === "A2")!.status, "completed");
    });

    it("marks all levels above the user's level as 'locked'", async () => {
        const config = makeMockConfig([makeUser("A1").toBSON()], [], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.levels.find(l => l.level === "A2")!.status, "locked");
        assert.equal(result.levels.find(l => l.level === "C2")!.status, "locked");
    });

    it("reports correct modulesTotal for each level", async () => {
        const modules = [makeModule("a1-1", "A1"), makeModule("a1-2", "A1"), makeModule("a2-1", "A2")];
        const config = makeMockConfig([makeUser("A1").toBSON()], modules.map(m => m.toBSON()), []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.levels.find(l => l.level === "A1")!.modulesTotal, 2);
        assert.equal(result.levels.find(l => l.level === "A2")!.modulesTotal, 1);
        assert.equal(result.levels.find(l => l.level === "B1")!.modulesTotal, 0);
    });

    it("reports correct modulesCompleted for each level", async () => {
        const modules = [makeModule("a1-1", "A1"), makeModule("a1-2", "A1"), makeModule("a2-1", "A2")];
        const progress = [
            makeProgress("a1-1", "completed"),
            makeProgress("a1-2", "in_progress"),
        ];
        const config = makeMockConfig([makeUser("A1").toBSON()], modules.map(m => m.toBSON()), progress.map(p => p.toBSON()));
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.levels.find(l => l.level === "A1")!.modulesCompleted, 1);
        assert.equal(result.levels.find(l => l.level === "A2")!.modulesCompleted, 0);
    });
});


describe("GetMeProgress.do - modules list selection", () => {

    it("defaults to the user's current CEFR level when no cefrLevel param is given", async () => {
        const modules = [makeModule("a1-1", "A1"), makeModule("a2-1", "A2")];
        const config = makeMockConfig([makeUser("A1").toBSON()], modules.map(m => m.toBSON()), []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);   // no cefrLevel in request

        assert.equal(result.modules.length, 1);
        assert.equal(result.modules[0].moduleId, "a1-1");
    });

    it("returns modules for the requested cefrLevel when provided", async () => {
        const modules = [makeModule("a1-1", "A1"), makeModule("a2-1", "A2"), makeModule("a2-2", "A2")];
        const config = makeMockConfig([makeUser("A1").toBSON()], modules.map(m => m.toBSON()), []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({ cefrLevel: "A2" }, userContext);

        assert.equal(result.modules.length, 2);
        assert.deepEqual(result.modules.map(m => m.moduleId), ["a2-1", "a2-2"]);
    });
});

describe("GetMeProgress.do - per-module status and step", () => {

    it("first module of a CEFR level cannot be locked", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON(), makeModule("a1-2", "A1").toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m1 = result.modules[0];
        const m2 = result.modules[1];

        assert.equal(m1.status, "available");
        assert.equal(m1.step, "grammar");
        assert.equal(m2.status, "locked");
        assert.isNull(m2.step);
    });


    it("module after first with no progress record has 'locked' status and null step", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON(), makeModule("a1-2", "A1").toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[1];

        assert.equal(m.status, "locked");
        assert.isNull(m.step);
    });

    it("module with 'available' status has 'grammar' step", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [makeProgress("a1-1", "available").toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].step, "grammar");
    });

    it("module with 'in_progress' status has 'practice' step", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [makeProgress("a1-1", "in_progress", { startedAt: "2026-01-01T10:00:00.000Z" }).toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].step, "practice");
    });

    it("module with 'completed' status has 'done' step and completionPct 100", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3"]).toBSON()],
            [makeProgress("a1-1", "completed", { rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3"] })], completedAt: "2026-01-02T10:00:00.000Z" }).toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[0];

        assert.equal(m.step, "done");
        assert.equal(m.completionPct, 100);
    });

    it("module after a 'completed' module is 'available' if no progress is recorded", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3"]).toBSON(), makeModule("a1-2", "A1").toBSON()],
            [makeProgress("a1-1", "completed", { rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3"] })], completedAt: "2026-01-02T10:00:00.000Z" }).toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[1];

        assert.equal(m.status, "available");
        assert.equal(m.step, "grammar");
    });

    it("module after a re-practised (available, passNumber >= 2) module is still 'available', not re-locked (F25)", async () => {
        // Module a1-1 was completed, then reset by a re-practice: status is back to 'available'
        // and passNumber climbed to 2. Module a1-2 holds no progress record of its own, so its
        // lock state is derived from a1-1 — and must not be re-locked by a decision about a1-1.
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3"]).toBSON(), makeModule("a1-2", "A1").toBSON()],
            [makeProgress("a1-1", "available", { passNumber: 2 }).toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[1];

        assert.equal(m.status, "available");
        assert.equal(m.step, "grammar");
    });

    it("module includes startedAt and completedAt from the progress record", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [makeProgress("a1-1", "completed", {
                startedAt: "2026-01-01T10:00:00.000Z",
                completedAt: "2026-01-02T10:00:00.000Z",
            }).toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[0];

        assert.equal(m.startedAt, "2026-01-01T10:00:00.000Z");
        assert.equal(m.completedAt, "2026-01-02T10:00:00.000Z");
    });

    it("includes the module title from the catalog", async () => {
        const mod = new Module({
            id: "a1-1", title: "Who Are You?", theme: "T", communicationGoal: "G",
            cefrLevel: "A1" as any, vocabularyItemIds: [], grammarConceptIds: [], isUserGenerated: false,
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [mod.toBSON()], []);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].title, "Who Are You?");
    });
});


describe("GetMeProgress.do - test timing", () => {

    it("testUnlocksAt is null when practiceCompletedAt is not set (Step 2 incomplete)", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [makeProgress("a1-1", "in_progress").toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.isNull(result.modules[0].testUnlocksAt);
    });

    it("testUnlocksAt is practiceCompletedAt plus testUnlockDelayHours when Step 2 is complete", async () => {
        const module = makeModule("a1-1", "A1", [], { testUnlockDelayHours: 4 });
        const progress = makeProgress("a1-1", "in_progress", { practiceCompletedAt: "2026-01-10T09:00:00.000Z" });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        // 09:00 + 4 hours = 13:00
        assert.equal(result.modules[0].testUnlocksAt, "2026-01-10T13:00:00.000Z");
    });

    it("testRetryAvailableAt is null when there are no test attempts", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [makeProgress("a1-1", "in_progress").toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.isNull(result.modules[0].testRetryAvailableAt);
    });

    it("testRetryAvailableAt is null when the only attempt passed", async () => {
        const progress = makeProgress("a1-1", "completed", {
            testAttempts: [makeAttempt(true, "2026-01-10T09:00:00.000Z")],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.isNull(result.modules[0].testRetryAvailableAt);
    });

    it("testRetryAvailableAt is last-failed-attempt takenAt plus testRetryDelayMinutes", async () => {
        const module = makeModule("a1-1", "A1", [], { testRetryDelayMinutes: 20 });
        const progress = makeProgress("a1-1", "in_progress", {
            testAttempts: [makeAttempt(false, "2026-01-10T09:00:00.000Z")],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        // 09:00 + 20 minutes = 09:20
        assert.equal(result.modules[0].testRetryAvailableAt, "2026-01-10T09:20:00.000Z");
    });

    it("uses the most recent failed attempt when multiple attempts exist", async () => {
        const module = makeModule("a1-1", "A1", [], { testRetryDelayMinutes: 20 });
        const progress = makeProgress("a1-1", "in_progress", {
            testAttempts: [
                makeAttempt(false, "2026-01-10T08:00:00.000Z"),  // earlier failure
                makeAttempt(false, "2026-01-10T10:00:00.000Z"),  // most recent failure
            ],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        // 10:00 + 20 minutes = 10:20 (not 08:20)
        assert.equal(result.modules[0].testRetryAvailableAt, "2026-01-10T10:20:00.000Z");
    });
});

describe("GetMeProgress.do - vocabularyItemsPracticedCount", () => {

    it("returns 0 when no progress record exists for the module", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1").toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 0);
        assert.equal(result.modules[0].completionPct, 0);
    });

    it("counts the vocabulary items covered at rung 1", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 1,
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3"] })],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 3);
        assert.equal(result.modules[0].completionPct, 60); // 3 out of 5 items covered
    });

    it("counts an item once even when it is covered at several rungs", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 2,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1"] }),
            ],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 2);
        assert.equal(result.modules[0].completionPct, 50);
    });

    it("ignores grammar concept ids when counting vocabulary coverage", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 1,
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "g1", "g2"] })],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 1);
        assert.equal(result.modules[0].completionPct, 50);
    });

    it("returns the full vocabulary count when every item has been covered", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 2,
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3", "v4", "v5"], completedAt: "2026-01-10T10:00:00.000Z" })],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 5);
        assert.equal(result.modules[0].completionPct, 100);
    });

    it("returns 0 when a progress record exists but nothing has been covered yet", async () => {
        const progress = makeProgress("a1-1", "in_progress", { rungCoverage: [] });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 0);
        assert.equal(result.modules[0].completionPct, 0);
    });

    it("reports a completed module as fully covered even though it holds no rung coverage", async () => {

        // Modules completed before the practice ladder shipped have no rungCoverage at all.
        const progress = makeProgress("a1-1", "completed", { rungCoverage: [], completedAt: "2026-01-02T10:00:00.000Z" });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].completionPct, 100);
        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 5);
    });
});

describe("GetMeProgress.do - currentRung", () => {

    it("defaults to rung 1 when no progress record exists for the module", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].currentRung, 1);
    });

    it("reports the rung the progress record is currently at", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 2,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1"] }),
            ],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].currentRung, 2);
    });
});

describe("GetMeProgress.do - fullyCompletedRungs", () => {

    it("is 0 when no progress record exists for the module", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].fullyCompletedRungs, 0);
    });

    it("is currentRung - 1 while the ladder is still in progress", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 3,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1", "v2"], completedAt: "2026-01-10T10:00:00.000Z" }),
                new RungCoverage({ rung: 3, itemIds: [] }),
            ],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].fullyCompletedRungs, 2);
    });

    it("is 3 once practiceCompletedAt is set, regardless of currentRung", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 3,
            practiceCompletedAt: "2026-01-11T10:00:00.000Z",
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1", "v2"], completedAt: "2026-01-10T10:00:00.000Z" }),
                new RungCoverage({ rung: 3, itemIds: ["v1", "v2"], completedAt: "2026-01-11T10:00:00.000Z" }),
            ],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].fullyCompletedRungs, 3);
    });

    it("is 3 for a module completed before the practice ladder shipped (no rung coverage)", async () => {
        const progress = makeProgress("a1-1", "completed", { rungCoverage: [], completedAt: "2026-01-02T10:00:00.000Z" });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].fullyCompletedRungs, 3);
    });
});

describe("GetMeProgress.do - currentRungCoverage", () => {

    it("is 0/totalCount when no progress record exists for the module", async () => {
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3"]).toBSON()],
            []
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.deepEqual(result.modules[0].currentRungCoverage, { coveredCount: 0, totalCount: 3 });
    });

    it("counts practice items covered at the current rung only", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 2,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1"] }),
            ],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.deepEqual(result.modules[0].currentRungCoverage, { coveredCount: 1, totalCount: 2 });
    });

    it("pools vocabulary and grammar concept ids into totalCount", async () => {
        const module = new Module({
            id: "a1-1", title: "Module a1-1", theme: "T", communicationGoal: "G",
            cefrLevel: "A1" as any, vocabularyItemIds: ["v1", "v2"], grammarConceptIds: ["g1"], isUserGenerated: false,
        });
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 1,
            rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v1", "g1"] })],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.deepEqual(result.modules[0].currentRungCoverage, { coveredCount: 2, totalCount: 3 });
    });

    it("reports full coverage for a completed module even though it holds no rung coverage", async () => {
        const progress = makeProgress("a1-1", "completed", { rungCoverage: [], completedAt: "2026-01-02T10:00:00.000Z" });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.deepEqual(result.modules[0].currentRungCoverage, { coveredCount: 3, totalCount: 3 });
    });
});

describe("GetMeProgress.do - rung 3 practice completion scenarios", () => {

    it("reports partial rung-3 coverage when the user has covered 2 of 3 words and 1 of 2 grammar concepts", async () => {
        const module = new Module({
            id: "a1-1", title: "Module a1-1", theme: "T", communicationGoal: "G",
            cefrLevel: "A1" as any, vocabularyItemIds: ["v1", "v2", "v3"], grammarConceptIds: ["g1", "g2"], isUserGenerated: false,
        });
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 3,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-10T10:00:00.000Z" }),
                new RungCoverage({ rung: 3, itemIds: ["v1", "v2", "g1"] }),  // 2/3 words, 1/2 grammar concepts — rung not yet complete
            ],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[0];

        assert.equal(m.currentRung, 3);
        assert.deepEqual(m.currentRungCoverage, { coveredCount: 3, totalCount: 5 });
        assert.equal(m.fullyCompletedRungs, 2);
        assert.equal(m.status, "in_progress");
        assert.equal(m.step, "practice");
    });

    it("reports full rung-3 coverage and unlocks the module test when all 3 words and 2 grammar concepts are covered", async () => {
        const module = new Module({
            id: "a1-1", title: "Module a1-1", theme: "T", communicationGoal: "G",
            cefrLevel: "A1" as any, vocabularyItemIds: ["v1", "v2", "v3"], grammarConceptIds: ["g1", "g2"], isUserGenerated: false,
        });
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 3,
            practiceCompletedAt: "2026-01-11T10:00:00.000Z",  // the whole ladder completed with this last rung-3 session
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-10T10:00:00.000Z" }),
                new RungCoverage({ rung: 3, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-11T10:00:00.000Z" }),
            ],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[0];

        assert.equal(m.currentRung, 3);
        assert.deepEqual(m.currentRungCoverage, { coveredCount: 5, totalCount: 5 });
        assert.equal(m.fullyCompletedRungs, 3);
        assert.equal(m.status, "in_progress");
        assert.equal(m.step, "test");  // practiceCompletedAt is set, so the module now awaits the Module Test
    });
});

describe("GetMeProgress.do - rung 2 practice completion scenario", () => {

    it("reports full rung-2 coverage without crediting the current rung towards fullyCompletedRungs", async () => {
        const module = new Module({
            id: "a1-1", title: "Module a1-1", theme: "T", communicationGoal: "G",
            cefrLevel: "A1" as any, vocabularyItemIds: ["v1", "v2", "v3"], grammarConceptIds: ["g1", "g2"], isUserGenerated: false,
        });
        const progress = makeProgress("a1-1", "in_progress", {
            currentRung: 2,
            rungCoverage: [
                new RungCoverage({ rung: 1, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-09T10:00:00.000Z" }),
                new RungCoverage({ rung: 2, itemIds: ["v1", "v2", "v3", "g1", "g2"], completedAt: "2026-01-10T10:00:00.000Z" }),  // all 3 words + both grammar concepts covered
            ],
        });
        const config = makeMockConfig([makeUser("A1").toBSON()], [module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);
        const m = result.modules[0];

        assert.equal(m.currentRung, 2);
        assert.deepEqual(m.currentRungCoverage, { coveredCount: 5, totalCount: 5 });
        assert.equal(m.fullyCompletedRungs, 1);  // only rung 1 is behind currentRung; rung 2 itself isn't counted until the ladder advances past it
        assert.equal(m.status, "in_progress");
        assert.equal(m.step, "practice");
    });
});

describe("GetMeProgress.do - module proficiency", () => {

    /**
     * Builds a mock config that additionally backs the three collections the lazy User Proficiency
     * Score backfill reads, and records every write to the progress collection.
     */
    function makeProficiencyMockConfig(moduleDocs: any[], progressDocs: any[], { attemptDocs = [] as any[], sessionDocs = [] as any[], exerciseDocs = [] as any[] } = {}) {

        const updates: any[] = [];
        const reads = { attempts: 0 };

        const collections: Record<string, any> = {
            users: { findOne: async () => makeUser("A1").toBSON() },
            modules: { find: () => ({ sort: () => ({ toArray: async () => moduleDocs }) }) },
            userModuleProgress: {
                find: (filter: any) => ({ toArray: async () => progressDocs.filter(d => d.userId === filter.userId) }),
                updateOne: async (filter: any, update: any) => {
                    updates.push({ filter, update });
                    return { matchedCount: 1 };
                },
            },
            moduleTestAttempts: {
                findOne: async (filter: any, options: any = {}) => {
                    reads.attempts++;
                    const submitted = attemptDocs.filter(d => d.moduleId === filter.moduleId && d.takenAt !== null);
                    if (options.sort?.takenAt === 1) submitted.sort((a, b) => a.takenAt > b.takenAt ? 1 : -1);
                    return submitted[0] ?? null;
                },
            },
            practiceSessions: {
                find: (filter: any) => ({ toArray: async () => sessionDocs.filter(d => d.moduleId === filter.moduleId && d.completedAt !== null) }),
            },
            exercises: {
                find: (filter: any) => ({ toArray: async () => exerciseDocs.filter(d => filter.id.$in.includes(d.id)) }),
            },
        };

        const config = {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any;

        return { config, updates, reads };
    }

    function makeSubmittedAttempt(moduleId: string, correct: number, total: number, takenAt: string) {
        const exerciseIds = Array.from({ length: total }, (_, i) => `t-${moduleId}-${i}`);
        return {
            _id: new ObjectId(),
            userId: "uuid-001",
            moduleId,
            exerciseIds,
            answers: exerciseIds.map((id, i) => ({ exerciseId: id, isCorrect: i < correct, userAnswer: "hej", answeredAt: takenAt })),
            startedAt: "2026-06-11T09:00:00.000Z",
            takenAt,
        };
    }

    const module = makeModule("a1-1", "A1", ["v1"]);

    it("reports no proficiency for a module that is not completed", async () => {

        const { config } = makeProficiencyMockConfig([module.toBSON()], [makeProgress("a1-1", "in_progress").toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.isNull(result.modules[0].proficiency);
    });

    it("returns the stored proficiency of a completed module", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });
        progress.proficiency = new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-08-01T10:00:00.000Z", version: PROFICIENCY_VERSION });

        const { config } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.deepEqual(result.modules[0].proficiency, { score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", passNumber: 1 });
    });

    it("rides passNumber along on the proficiency of a re-practised module (F25)", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z", passNumber: 2 });
        progress.proficiency = new ModuleProficiency({ score: 80, testScore: 80, practiceScore: null, basis: "test-only", computedAt: "2026-08-01T10:00:00.000Z", version: PROFICIENCY_VERSION, passNumber: 2 });

        const { config } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].proficiency!.passNumber, 2);
    });

    it("does not recompute a stored score that is already at the current formula version", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });
        progress.proficiency = new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-08-01T10:00:00.000Z", version: PROFICIENCY_VERSION });

        const { config, updates, reads } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        await delegate.do({}, userContext);

        assert.equal(reads.attempts, 0, "a stored score at the current version must be a plain read");
        assert.equal(updates.length, 0);
    });

    it("backfills and stores the proficiency of a completed module that has none", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });
        const attempt = makeSubmittedAttempt("a1-1", 16, 20, "2026-06-12T09:00:00.000Z");

        const { config, updates } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()], { attemptDocs: [attempt] });
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        // 16/20 on the first attempt → 100 × 16 / (16 + 3×4) = 57.1 ; no practice answers → test-only
        assert.equal(result.modules[0].proficiency!.score, 57.1);
        assert.equal(result.modules[0].proficiency!.basis, "test-only");
        assert.isNull(result.modules[0].proficiency!.practiceScore);

        assert.equal(updates.length, 1, "the backfilled score must be persisted");
        assert.equal(updates[0].update.$set.proficiency.score, 57.1);
    });

    it("recomputes a stored score that carries an older formula version", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });
        progress.proficiency = new ModuleProficiency({ score: 12.3, testScore: 12.3, practiceScore: null, basis: "test-only", computedAt: "2026-08-01T10:00:00.000Z", version: PROFICIENCY_VERSION - 1 });
        const attempt = makeSubmittedAttempt("a1-1", 20, 20, "2026-06-12T09:00:00.000Z");

        const { config, updates } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()], { attemptDocs: [attempt] });
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].proficiency!.score, 100);
        assert.equal(updates.length, 1);
    });

    it("reports no proficiency when a completed module has no submitted test attempt to score", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });

        const { config, updates } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()]);
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.isNull(result.modules[0].proficiency);
        assert.equal(updates.length, 0, "nothing to store when there is nothing to score");
    });

    it("blends the practice answers of the sessions completed before the module was completed", async () => {

        const progress = makeProgress("a1-1", "completed", { completedAt: "2026-06-12T10:00:00.000Z" });
        const attempt = makeSubmittedAttempt("a1-1", 20, 20, "2026-06-12T09:00:00.000Z");
        const exercise = new Exercise({ id: "ex-r3", moduleId: "a1-1", type: "translation_active", prompt: "p", answer: "a", vocabularyItemId: "v1" });
        const session = {
            _id: new ObjectId(), userId: "uuid-001", moduleId: "a1-1",
            answers: [{ exerciseId: "ex-r3", isCorrect: false, userAnswer: "x", answeredAt: "2026-06-10T10:00:00.000Z" }, { exerciseId: "ex-r3", isCorrect: true, userAnswer: "a", answeredAt: "2026-06-10T10:01:00.000Z" }],
            verifiedExerciseIds: [], startedAt: "2026-06-10T09:00:00.000Z", completedAt: "2026-06-10T10:02:00.000Z",
        };

        const { config } = makeProficiencyMockConfig([module.toBSON()], [progress.toBSON()], { attemptDocs: [attempt], sessionDocs: [session], exerciseDocs: [exercise.toBSON()] });
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        // Flawless test (100) blended with a 1-of-2 rung-3 practice run (50) → 0.6×100 + 0.4×50
        assert.equal(result.modules[0].proficiency!.practiceScore, 50);
        assert.equal(result.modules[0].proficiency!.score, 80);
        assert.equal(result.modules[0].proficiency!.basis, "practice-rung3-only");
    });
});
