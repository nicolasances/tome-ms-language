import { assert } from "chai";
import { Request } from "express";
import { User } from "../src/model/User";
import { Module } from "../src/model/Module";
import { UserModuleProgress } from "../src/model/UserModuleProgress";
import { GetMeLevelProgress } from "../src/dlg/user/GetMeLevelProgress";

const userContext = { email: "alice@example.com", userId: "u1", authProvider: "test" };

function makeUser(cefrLevel = "A1") {
    return new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: cefrLevel as any, createdAt: "2026-01-01T00:00:00.000Z" });
}

function makeModule(id: string, cefrLevel = "A1") {
    return new Module({ id, title: "T", theme: "T", communicationGoal: "G", cefrLevel: cefrLevel as any, vocabularyItemIds: [], grammarConceptIds: [], isUserGenerated: false });
}

function makeProgress(moduleId: string, status: string): UserModuleProgress {
    return new UserModuleProgress({ userId: "uuid-001", moduleId, status: status as any, startedAt: null, completedAt: null, testAttempts: [] });
}

function makeMockConfig(userDocs: any[], moduleDocs: any[], progressDocs: any[]) {
    const userCol = {
        findOne: async (filter: any) => userDocs.find(d => d.email === filter.email) ?? null,
    };
    const moduleCol = {
        find: (filter: any) => ({
            sort: (_s: any) => ({
                toArray: async () => moduleDocs.filter(d => !filter.cefrLevel || d.cefrLevel === filter.cefrLevel),
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

describe("GetMeLevelProgress.parseRequest", () => {

    it("returns an empty object â€” no params needed", () => {
        const delegate = new GetMeLevelProgress({} as any, {} as any);
        const parsed = delegate.parseRequest({ params: {}, query: {}, body: {} } as unknown as Request);

        assert.deepEqual(parsed, {});
    });
});

describe("GetMeLevelProgress.do", () => {

    it("returns allCompleted: false when some modules have no progress record", async () => {
        const mod1 = makeModule("mod-1");
        const mod2 = makeModule("mod-2");
        const config = makeMockConfig(
            [makeUser().toBSON()],
            [mod1.toBSON(), mod2.toBSON()],
            [makeProgress("mod-1", "completed").toBSON()]   // mod-2 has no record
        );
        const delegate = new GetMeLevelProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.allCompleted, false);
        assert.equal(result.cefrLevel, "A1");
    });

    it("returns allCompleted: true when every module at the level is completed", async () => {
        const mod1 = makeModule("mod-1");
        const mod2 = makeModule("mod-2");
        const config = makeMockConfig(
            [makeUser().toBSON()],
            [mod1.toBSON(), mod2.toBSON()],
            [makeProgress("mod-1", "completed").toBSON(), makeProgress("mod-2", "completed").toBSON()]
        );
        const delegate = new GetMeLevelProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.allCompleted, true);
    });

    it("treats modules with no progress record as locked in the summary", async () => {
        const mod1 = makeModule("mod-1");
        const config = makeMockConfig(
            [makeUser().toBSON()],
            [mod1.toBSON()],
            []  // no progress record at all
        );
        const delegate = new GetMeLevelProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules[0].status, "locked");
    });

    it("returns one entry per module at the user's current level", async () => {
        const mods = [makeModule("mod-1"), makeModule("mod-2"), makeModule("mod-3")];
        const config = makeMockConfig(
            [makeUser().toBSON()],
            mods.map(m => m.toBSON()),
            []
        );
        const delegate = new GetMeLevelProgress({} as any, config);

        const result = await delegate.do({}, userContext);

        assert.equal(result.modules.length, 3);
    });

    it("throws 404 when the user profile is not found", async () => {
        const config = makeMockConfig([], [], []);
        const delegate = new GetMeLevelProgress({} as any, config);

        try {
            await delegate.do({}, userContext);
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});

