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
            toArray: async () => {
                return docs.filter(doc => {
                    if (doc.userId !== filter.userId) return false;
                    if (filter.moduleId?.$in && !filter.moduleId.$in.includes(doc.moduleId)) return false;
                    return true;
                });
            },
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

describe("UserModuleProgressStore.findByUserAndModule", () => {

    it("returns the progress record when it exists", async () => {
        const doc = makeProgress({ userId: "user-1", moduleId: "mod-1", status: "in_progress" }).toBSON();
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([doc])), config: {} as any });

        const result = await store.findByUserAndModule("user-1", "mod-1");

        assert.isNotNull(result);
        assert.equal(result!.userId, "user-1");
        assert.equal(result!.moduleId, "mod-1");
        assert.equal(result!.status, "in_progress");
    });

    it("returns null when no record exists for the user+module pair", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.findByUserAndModule("user-1", "mod-1");

        assert.isNull(result);
    });
});

describe("UserModuleProgressStore.listByUser", () => {

    const seedDocs = [
        makeProgress({ userId: "user-1", moduleId: "mod-1", status: "completed" }).toBSON(),
        makeProgress({ userId: "user-1", moduleId: "mod-2", status: "in_progress" }).toBSON(),
        makeProgress({ userId: "user-1", moduleId: "mod-3", status: "available" }).toBSON(),
        makeProgress({ userId: "user-2", moduleId: "mod-1", status: "available" }).toBSON(),
    ];

    it("returns all progress records for the user when no moduleIds filter is given", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        assert.equal(result.length, 3);
        result.forEach(r => assert.equal(r.userId, "user-1"));
    });

    it("returns only records matching the moduleIds filter", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1", ["mod-1", "mod-2"]);

        assert.equal(result.length, 2);
        const ids = result.map(r => r.moduleId);
        assert.include(ids, "mod-1");
        assert.include(ids, "mod-2");
    });

    it("returns an empty array when the user has no progress records", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-99");

        assert.deepEqual(result, []);
    });

    it("does not return records belonging to other users", async () => {
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([...seedDocs])), config: {} as any });

        const result = await store.listByUser("user-1");

        result.forEach(r => assert.equal(r.userId, "user-1"));
    });
});
