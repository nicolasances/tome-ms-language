import { assert } from "chai";
import { RungCoverage, UserModuleProgress } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "user-1", moduleId: "mod-1", status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z", completedAt: null, testAttempts: [],
        ...overrides,
    });
}

/**
 * Mock collection simulating the positional-operator updates the store issues against
 * rungCoverage: $addToSet with $each on a matched array element, and $push of a new element.
 */
function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) => docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        updateOne: async (filter: any, update: any) => {

            const doc = docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId);

            if (!doc) return { matchedCount: 0 };

            doc.rungCoverage = doc.rungCoverage ?? [];

            const rungFilter = filter["rungCoverage.rung"];
            const entry = rungFilter !== undefined ? doc.rungCoverage.find((c: any) => c.rung === rungFilter) : null;

            if (rungFilter !== undefined && !entry) return { matchedCount: 0 };

            if (update.$addToSet?.["rungCoverage.$.itemIds"]) {
                const toAdd = update.$addToSet["rungCoverage.$.itemIds"].$each as string[];
                for (const id of toAdd) if (!entry.itemIds.includes(id)) entry.itemIds.push(id);
            }

            if (update.$push?.rungCoverage) doc.rungCoverage.push(update.$push.rungCoverage);

            return { matchedCount: 1 };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.appendRungCoverage", () => {

    it("creates the rung entry on first append and records the items", async () => {

        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, ["v-1", "v-2"]);

        assert.isNotNull(result);
        assert.equal(result!.rungCoverage.length, 1);
        assert.equal(result!.rungCoverage[0].rung, 1);
        assert.deepEqual(result!.rungCoverage[0].itemIds, ["v-1", "v-2"]);
        assert.isNull(result!.rungCoverage[0].completedAt);
    });

    it("adds to the existing rung entry without duplicating already-covered items (set-union)", async () => {

        const docs = [makeProgress({ rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, ["v-1", "v-2"]);

        assert.equal(result!.rungCoverage.length, 1);
        assert.deepEqual(result!.rungCoverage[0].itemIds, ["v-1", "v-2"]);
    });

    it("keeps each rung's coverage separate", async () => {

        const docs = [makeProgress({ rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1", "v-2"], completedAt: "2026-06-02T08:00:00.000Z" })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 2, ["v-1"]);

        assert.equal(result!.rungCoverage.length, 2);
        assert.deepEqual(result!.coverageAt(1)!.itemIds, ["v-1", "v-2"]);
        assert.equal(result!.coverageAt(1)!.completedAt, "2026-06-02T08:00:00.000Z");
        assert.deepEqual(result!.coverageAt(2)!.itemIds, ["v-1"]);
    });

    it("stores grammar concept ids alongside vocabulary item ids", async () => {

        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, ["v-1", "g-1"]);

        assert.deepEqual(result!.coverageAt(1)!.itemIds, ["v-1", "g-1"]);
    });

    it("de-duplicates the incoming ids when creating the rung entry", async () => {

        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, ["v-1", "v-1", "v-2"]);

        assert.deepEqual(result!.coverageAt(1)!.itemIds, ["v-1", "v-2"]);
    });

    it("returns null when no progress record exists", async () => {

        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, ["v-1"]);

        assert.isNull(result);
    });

    it("is a no-op read when there are no items to append", async () => {

        const docs = [makeProgress().toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.appendRungCoverage("user-1", "mod-1", 1, []);

        assert.deepEqual(result!.rungCoverage, []);
    });
});
