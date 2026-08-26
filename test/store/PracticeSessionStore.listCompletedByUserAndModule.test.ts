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
 * filter and the `passNumber` $or-legacy filter the store uses. Docs with no `passNumber` field
 * at all simulate sessions written before F25 — real Mongo equality never matches a missing
 * field, so, like the store, this mock only lets them through via the `$exists: false` branch.
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
                    if (filter.$or) {
                        const matchesOr = filter.$or.some((clause: any) => {
                            const val = clause.passNumber;
                            if (val && typeof val === "object" && "$exists" in val) return val.$exists === false ? !("passNumber" in d) : ("passNumber" in d);
                            return d.passNumber === val;
                        });
                        if (!matchesOr) return false;
                    } else if (filter.passNumber !== undefined && d.passNumber !== filter.passNumber) {
                        return false;
                    }
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

        const { store } = makeStore([makeSessionBSON({ passNumber: 1 }), makeSessionBSON({ completedAt: "2026-06-10T10:00:00.000Z", passNumber: 1 })]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result.length, 2);
        assert.instanceOf(result[0], PracticeSession);
    });

    it("excludes sessions that were abandoned rather than completed", async () => {

        const { store } = makeStore([makeSessionBSON({ completedAt: null, passNumber: 1 }), makeSessionBSON({ passNumber: 1 })]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result.length, 1);
        assert.equal(result[0].completedAt, "2026-06-09T10:00:00.000Z");
    });

    it("excludes sessions of other modules", async () => {

        const { store } = makeStore([makeSessionBSON({ moduleId: "other-mod", passNumber: 1 })]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result.length, 0);
    });

    it("excludes sessions completed after the given cutoff — 'keep practising' runs never count", async () => {

        const beforeCompletion = makeSessionBSON({ completedAt: "2026-06-09T10:00:00.000Z", passNumber: 1 });
        const afterCompletion = makeSessionBSON({ completedAt: "2026-07-01T10:00:00.000Z", passNumber: 1 });

        const { store } = makeStore([beforeCompletion, afterCompletion]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 1, "2026-06-20T00:00:00.000Z");

        assert.equal(result.length, 1);
        assert.equal(result[0].completedAt, "2026-06-09T10:00:00.000Z");
    });

    it("applies no upper bound when no cutoff is given", async () => {

        const { collection, store } = makeStore([makeSessionBSON({ passNumber: 1 })]);

        await store.listCompletedByUserAndModule("user-1", "mod-1", 1);

        assert.isUndefined(collection.lastFilter.completedAt.$lte);
    });

    it("excludes sessions from an earlier pass — a re-practice's score must not pool in the old pass's answers (F25)", async () => {

        const passOneSession = makeSessionBSON({ passNumber: 1 });
        const passTwoSession = makeSessionBSON({ passNumber: 2, completedAt: "2026-07-10T10:00:00.000Z" });

        const { store } = makeStore([passOneSession, passTwoSession]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 2);

        assert.equal(result.length, 1);
        assert.equal(result[0].passNumber, 2);
    });

    it("includes legacy sessions with no passNumber field at all when scoring pass 1", async () => {

        const legacySession = makeSessionBSON();
        delete legacySession.passNumber;

        const { store } = makeStore([legacySession]);

        const result = await store.listCompletedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result.length, 1);
    });
});
