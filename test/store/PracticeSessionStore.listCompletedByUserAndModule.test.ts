import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSession } from "../../src/model/PracticeSession";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

function makeSessionBSON(overrides: any = {}): any {
    return {
        _id: new ObjectId(),
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        verifiedExerciseIds: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: "2026-06-09T10:00:00.000Z",
        ...overrides,
    };
}

/**
 * In-memory mock of the practiceSessions collection supporting the `completedAt: { $ne, $lte }`
 * filter the store uses.
 */
function makeMockCollection(docs: any[]) {

    return {
        lastFilter: null as any,
        find: function (filter: any) {

            this.lastFilter = filter;

            return {
                toArray: async () => docs.filter(d => {
                    if (d.userId !== filter.userId) return false;
                    if (d.moduleId !== filter.moduleId) return false;
                    if (filter.completedAt?.$ne === null && d.completedAt === null) return false;
                    if (filter.completedAt?.$lte && d.completedAt > filter.completedAt.$lte) return false;
                    return true;
                }),
            };
        },
    };
}

function makeStore(docs: any[]) {
    const collection = makeMockCollection(docs);
    return { store: new PracticeSessionStore({ db: { collection: () => collection } as any, config: {} as any }), collection };
}

describe("PracticeSessionStore.listCompletedByUserAndModule", () => {

    it("returns the completed sessions of the user+module as PracticeSession instances", async () => {

        const { store } = makeStore([makeSessionBSON(), makeSessionBSON({ completedAt: "2026-06-10T10:00:00.000Z" })]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1");

        assert.equal(result.length, 2);
        assert.instanceOf(result[0], PracticeSession);
    });

    it("excludes sessions that were abandoned rather than completed", async () => {

        const { store } = makeStore([makeSessionBSON({ completedAt: null }), makeSessionBSON()]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1");

        assert.equal(result.length, 1);
        assert.equal(result[0].completedAt, "2026-06-09T10:00:00.000Z");
    });

    it("excludes sessions of other modules", async () => {

        const { store } = makeStore([makeSessionBSON({ moduleId: "other-mod" })]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1");

        assert.equal(result.length, 0);
    });

    it("excludes sessions completed after the given cutoff — 'keep practising' runs never count", async () => {

        const beforeCompletion = makeSessionBSON({ completedAt: "2026-06-09T10:00:00.000Z" });
        const afterCompletion = makeSessionBSON({ completedAt: "2026-07-01T10:00:00.000Z" });

        const { store } = makeStore([beforeCompletion, afterCompletion]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", "2026-06-20T00:00:00.000Z");

        assert.equal(result.length, 1);
        assert.equal(result[0].completedAt, "2026-06-09T10:00:00.000Z");
    });

    it("applies no upper bound when no cutoff is given", async () => {

        const { collection, store } = makeStore([makeSessionBSON()]);

        await store.listCompletedByUserAndModule("user-1", "mod-1");

        assert.isUndefined(collection.lastFilter.completedAt.$lte);
    });
});
