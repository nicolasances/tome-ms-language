import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

const TZ = "Europe/Copenhagen";

function makeDoc(userId: string, completedAt: string | null): any {
    return { _id: new ObjectId(), userId, moduleId: "mod-1", completedAt };
}

function makeMockCollection(initialDocs: any[]) {
    const docs = [...initialDocs];
    return {
        find: (filter: any) => ({
            toArray: async () => {
                return docs.filter(d => {
                    if (d.userId !== filter.userId) return false;
                    const ca = d.completedAt;
                    if (!ca) return false;
                    if (filter.completedAt?.$gte && ca < filter.completedAt.$gte) return false;
                    if (filter.completedAt?.$lte && ca > filter.completedAt.$lte) return false;
                    return true;
                });
            },
        }),
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("PracticeSessionStore.countCompletedByDay", () => {

    it("counts completed sessions bucketed by calendar day in the reference timezone", async () => {
        const docs = [
            makeDoc("u1", "2026-06-21T10:00:00.000Z"),
            makeDoc("u1", "2026-06-21T14:00:00.000Z"),
            makeDoc("u1", "2026-06-22T08:00:00.000Z"),
        ];
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 2);
        assert.equal(result.get("20260622"), 1);
        assert.isUndefined(result.get("20260623"));
    });

    it("excludes sessions with null completedAt (in-progress)", async () => {
        const docs = [
            makeDoc("u1", null),
            makeDoc("u1", "2026-06-21T10:00:00.000Z"),
        ];
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 1);
    });

    it("excludes sessions belonging to a different user", async () => {
        const docs = [
            makeDoc("u2", "2026-06-21T10:00:00.000Z"),
        ];
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });

    it("returns an empty map when no sessions fall in the window", async () => {
        const docs = [
            makeDoc("u1", "2026-06-10T10:00:00.000Z"),
        ];
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });
});
