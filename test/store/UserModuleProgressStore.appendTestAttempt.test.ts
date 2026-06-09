import { assert } from "chai";
import { UserModuleProgress, ModuleTestAttempt } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1", moduleId: "mod-1", status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z", completedAt: null, testAttempts: [],
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
        replaceOne: async (_f: any, doc: any, _o: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.moduleId === doc.moduleId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
        updateOne: async (filter: any, update: any) => {
            const doc = docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId);
            if (!doc) return { matchedCount: 0 };
            doc.testAttempts = doc.testAttempts ?? [];
            doc.testAttempts.push(update.$push.testAttempts);
            return { matchedCount: 1 };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.appendTestAttempt", () => {

    it("appends the attempt to testAttempts and returns the updated record", async () => {
        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-02T10:00:00.000Z" });

        const result = await store.appendTestAttempt("user-1", "mod-1", attempt);

        assert.isNotNull(result);
        assert.equal(result!.testAttempts.length, 1);
        assert.equal(result!.testAttempts[0].id, "att-1");
        assert.equal(result!.testAttempts[0].score, 85);
    });

    it("accumulates multiple attempts", async () => {
        const firstAttempt = new ModuleTestAttempt({ id: "att-1", score: 50, passed: false, takenAt: "2026-06-01T10:00:00.000Z" });
        const docs = [makeProgress({ testAttempts: [firstAttempt] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const secondAttempt = new ModuleTestAttempt({ id: "att-2", score: 90, passed: true, takenAt: "2026-06-02T10:00:00.000Z" });

        const result = await store.appendTestAttempt("user-1", "mod-1", secondAttempt);

        assert.equal(result!.testAttempts.length, 2);
    });

    it("returns null when no progress record exists", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });
        const attempt = new ModuleTestAttempt({ id: "att-1", score: 85, passed: true, takenAt: "2026-06-02T10:00:00.000Z" });

        const result = await store.appendTestAttempt("user-1", "mod-1", attempt);

        assert.isNull(result);
    });
});
