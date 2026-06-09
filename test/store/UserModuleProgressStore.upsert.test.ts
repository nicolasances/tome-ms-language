import { assert } from "chai";
import { UserModuleProgress, ModuleTestAttempt } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1",
        moduleId: "mod-1",
        status: "available",
        startedAt: null,
        completedAt: null,
        testAttempts: [],
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        find: (filter: any) => ({
            toArray: async () => docs.filter(d => d.userId === filter.userId),
        }),
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.moduleId === doc.moduleId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.upsert", () => {

    it("creates a new record when none exists", async () => {
        const docs: any[] = [];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const progress = makeProgress({ status: "in_progress", startedAt: "2026-06-01T09:00:00.000Z" });

        const result = await store.upsert(progress);

        assert.equal(result.userId, "user-1");
        assert.equal(result.status, "in_progress");
        assert.equal(docs.length, 1);
    });

    it("replaces an existing record without adding a duplicate", async () => {
        const existing = makeProgress({ status: "in_progress", startedAt: "2026-06-01T09:00:00.000Z" }).toBSON();
        const docs: any[] = [existing];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const updated = makeProgress({ status: "completed", startedAt: "2026-06-01T09:00:00.000Z", completedAt: "2026-06-02T10:00:00.000Z" });
        await store.upsert(updated);

        assert.equal(docs.length, 1, "should not add a duplicate");
        assert.equal(docs[0].status, "completed");
    });

    it("preserves testAttempts stored on the record", async () => {
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 80, passed: true, takenAt: "2026-06-02T10:00:00.000Z" });
        const existing = makeProgress({ status: "in_progress", testAttempts: [attempt] }).toBSON();
        const docs: any[] = [existing];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const updated = makeProgress({ status: "completed", testAttempts: [attempt] });
        const result = await store.upsert(updated);

        assert.equal(result.testAttempts.length, 1);
        assert.equal(result.testAttempts[0].id, "att-1");
    });
});
