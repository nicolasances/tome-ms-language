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
 * Mock collection simulating an $elemMatch-filtered positional $set against rungCoverage,
 * combined with a top-level $set of currentRung.
 */
function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) => docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        updateOne: async (filter: any, update: any) => {

            const doc = docs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId);

            if (!doc) return { matchedCount: 0 };

            doc.rungCoverage = doc.rungCoverage ?? [];

            const elemMatch = filter.rungCoverage?.$elemMatch;
            const entry = doc.rungCoverage.find((c: any) => c.rung === elemMatch.rung && c.completedAt === elemMatch.completedAt);

            if (!entry) return { matchedCount: 0 };

            for (const [key, value] of Object.entries(update.$set ?? {})) {
                if (key === "rungCoverage.$.completedAt") entry.completedAt = value;
                else doc[key] = value;
            }

            return { matchedCount: 1 };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserModuleProgressStore.completeRung", () => {

    it("stamps completedAt on the rung and advances currentRung to the next one", async () => {

        const docs = [makeProgress({ currentRung: 1, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"] })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.completeRung("user-1", "mod-1", 1, "2026-06-02T09:00:00.000Z");

        assert.equal(result!.coverageAt(1)!.completedAt, "2026-06-02T09:00:00.000Z");
        assert.equal(result!.currentRung, 2);
    });

    it("advances from rung 2 to rung 3", async () => {

        const docs = [makeProgress({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 2, itemIds: ["v-1"] })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.completeRung("user-1", "mod-1", 2, "2026-06-03T09:00:00.000Z");

        assert.equal(result!.currentRung, 3);
    });

    it("leaves currentRung at the last rung when the ladder is finished", async () => {

        const docs = [makeProgress({ currentRung: 3, rungCoverage: [new RungCoverage({ rung: 3, itemIds: ["v-1"] })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.completeRung("user-1", "mod-1", 3, "2026-06-04T09:00:00.000Z");

        assert.equal(result!.currentRung, 3);
        assert.equal(result!.coverageAt(3)!.completedAt, "2026-06-04T09:00:00.000Z");
    });

    it("is idempotent — an already-completed rung keeps its original completedAt", async () => {

        const docs = [makeProgress({ currentRung: 2, rungCoverage: [new RungCoverage({ rung: 1, itemIds: ["v-1"], completedAt: "2026-06-02T09:00:00.000Z" })] }).toBSON()];
        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.completeRung("user-1", "mod-1", 1, "2026-06-09T09:00:00.000Z");

        assert.isNull(result);
        assert.equal(UserModuleProgress.fromBSON(docs[0]).coverageAt(1)!.completedAt, "2026-06-02T09:00:00.000Z");
        assert.equal(UserModuleProgress.fromBSON(docs[0]).currentRung, 2);
    });

    it("returns null when no progress record exists", async () => {

        const store = new UserModuleProgressStore({ db: makeMockDb(makeMockCollection([])), config: {} as any });

        const result = await store.completeRung("user-1", "mod-1", 1, "2026-06-02T09:00:00.000Z");

        assert.isNull(result);
    });
});
