import { assert } from "chai";
import { Request } from "express";
import { User } from "../../../src/model/User";
import { Module } from "../../../src/model/Module";
import { UserModuleProgress, TestAttemptRecord } from "../../../src/model/UserModuleProgress";
import { GetMeProgress } from "../../../src/dlg/user/GetMeProgress";

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
    vocabularyItemsPracticed: string[];
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
    };
    return {
        getDBName: () => "test",
        getMongoDb: async () => ({
            collection: (name: string) => {
                if (name === "users") return userCol;
                if (name === "modules") return moduleCol;
                return progressCol;
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
            [makeProgress("a1-1", "completed", { vocabularyItemsPracticed: ["v1", "v2", "v3"], completedAt: "2026-01-02T10:00:00.000Z" }).toBSON()]
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
            [makeProgress("a1-1", "completed", { vocabularyItemsPracticed: ["v1", "v2", "v3"], completedAt: "2026-01-02T10:00:00.000Z" }).toBSON()]
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

    it("returns the count of vocabulary items seen so far during practice", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            vocabularyItemsPracticed: ["v1", "v2", "v3"],
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 3);
        assert.equal(result.modules[0].completionPct, 60); // 3 out of 5 items practiced
    });

    it("returns the full vocabulary count when all items have been practiced", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            vocabularyItemsPracticed: ["v1", "v2", "v3", "v4", "v5"],
            practiceCompletedAt: "2026-01-10T10:00:00.000Z",
        });
        const config = makeMockConfig(
            [makeUser("A1").toBSON()],
            [makeModule("a1-1", "A1", ["v1", "v2", "v3", "v4", "v5"]).toBSON()],
            [progress.toBSON()]
        );
        const delegate = new GetMeProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].vocabularyItemsPracticedCount, 5);
        assert.equal(result.modules[0].completionPct, 100); // 5 out of 5 items practiced
    });

    it("returns 0 when progress record exists but vocabularyItemsPracticed is empty", async () => {
        const progress = makeProgress("a1-1", "in_progress", {
            vocabularyItemsPracticed: [],
        });
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
});

