import { assert } from "chai";
import { User } from "../src/model/User";
import { UserModuleProgress, ModuleTestAttempt } from "../src/model/UserModuleProgress";
import { PutMeModuleProgress } from "../src/dlg/user/PutMeModuleProgress";

const userContext = { email: "alice@example.com", userId: "u1", authProvider: "test" };

function makeUser() {
    return new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" });
}

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "uuid-001",
        moduleId: "mod-1",
        status: "available",
        startedAt: null,
        completedAt: null,
        testAttempts: [],
        ...overrides,
    });
}

function makeMockConfig(userDocs: any[], progressDocs: any[]) {
    const userCol = {
        findOne: async (filter: any) => userDocs.find(d => d.email === filter.email) ?? null,
    };
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = progressDocs.findIndex(d => d.userId === doc.userId && d.moduleId === doc.moduleId);
            if (idx >= 0) progressDocs[idx] = doc; else progressDocs.push(doc);
            return {};
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({
            collection: (name: string) => name === "users" ? userCol : progressCol,
        }),
    } as any;
}

describe("PutMeModuleProgress.do", () => {

    it("creates a new in_progress record with startedAt set when no record exists", async () => {
        const progressDocs: any[] = [];
        const config = makeMockConfig([makeUser().toBSON()], progressDocs);
        const delegate = new PutMeModuleProgress({} as any, config);

        const result = await delegate.do({ moduleId: "mod-1", status: "in_progress" }, userContext);

        assert.equal(result.status, "in_progress");
        assert.equal(result.moduleId, "mod-1");
        assert.isNotNull(progressDocs[0].startedAt);
        assert.isNull(progressDocs[0].completedAt);
    });

    it("creates a new completed record with completedAt set when no record exists", async () => {
        const progressDocs: any[] = [];
        const config = makeMockConfig([makeUser().toBSON()], progressDocs);
        const delegate = new PutMeModuleProgress({} as any, config);

        await delegate.do({ moduleId: "mod-1", status: "completed" }, userContext);

        assert.isNotNull(progressDocs[0].completedAt);
    });

    it("does not overwrite startedAt when transitioning to in_progress again", async () => {
        const existingStartedAt = "2026-05-01T08:00:00.000Z";
        const existing = makeProgress({ status: "in_progress", startedAt: existingStartedAt }).toBSON();
        const config = makeMockConfig([makeUser().toBSON()], [existing]);
        const delegate = new PutMeModuleProgress({} as any, config);

        await delegate.do({ moduleId: "mod-1", status: "in_progress" }, userContext);

        assert.equal(existing.startedAt, existingStartedAt);
    });

    it("preserves testAttempts from the existing record during a status transition", async () => {
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 75, passed: false, takenAt: "2026-06-01T10:00:00.000Z" });
        const existing = makeProgress({ status: "in_progress", testAttempts: [attempt] }).toBSON();
        const progressDocs = [existing];
        const config = makeMockConfig([makeUser().toBSON()], progressDocs);
        const delegate = new PutMeModuleProgress({} as any, config);

        await delegate.do({ moduleId: "mod-1", status: "completed" }, userContext);

        assert.equal(progressDocs[0].testAttempts.length, 1);
        assert.equal(progressDocs[0].testAttempts[0].id, "att-1");
    });

    it("throws 404 when the user profile is not found", async () => {
        const config = makeMockConfig([], []);
        const delegate = new PutMeModuleProgress({} as any, config);

        try {
            await delegate.do({ moduleId: "mod-1", status: "in_progress" }, userContext);
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});

