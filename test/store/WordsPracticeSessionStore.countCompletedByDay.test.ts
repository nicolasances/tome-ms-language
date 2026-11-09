import { assert } from "chai";
import { ObjectId } from "mongodb";
import { WordsPracticeSessionStore } from "../../src/store/WordsPracticeSessionStore";

const TZ = "Europe/Copenhagen";

function makeDoc(userId: string, status: string, completedAt: string | null): any {
    return { _id: new ObjectId(), userId, status, completedAt };
}

function makeMockCollection(initialDocs: any[]) {
    const docs = [...initialDocs];
    return {
        find: (filter: any) => ({
            toArray: async () => {
                return docs.filter(d => {
                    if (d.userId !== filter.userId) return false;
                    if (filter.status && d.status !== filter.status) return false;
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

function makeStore(docs: any[]) {
    const db = { collection: () => makeMockCollection(docs) } as any;
    return new WordsPracticeSessionStore({ db, config: {} as any });
}

describe("WordsPracticeSessionStore.countCompletedByDay", () => {

    it("counts completed sessions bucketed by calendar day in the reference timezone", async () => {
        const store = makeStore([
            makeDoc("u1", "completed", "2026-06-21T10:00:00.000Z"),
            makeDoc("u1", "completed", "2026-06-21T14:00:00.000Z"),
            makeDoc("u1", "completed", "2026-06-22T08:00:00.000Z"),
        ]);

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 2);
        assert.equal(result.get("20260622"), 1);
        assert.isUndefined(result.get("20260623"));
    });

    it("buckets a late-evening UTC completion into the next Copenhagen day", async () => {
        const store = makeStore([makeDoc("u1", "completed", "2026-06-21T22:30:00.000Z")]);

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260622"), 1);
        assert.isUndefined(result.get("20260621"));
    });

    it("excludes in-progress sessions", async () => {
        const store = makeStore([
            makeDoc("u1", "in_progress", null),
            makeDoc("u1", "completed", "2026-06-21T10:00:00.000Z"),
        ]);

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 1);
    });

    it("excludes sessions of a different user", async () => {
        const store = makeStore([makeDoc("u2", "completed", "2026-06-21T10:00:00.000Z")]);

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });

    it("excludes sessions completed outside the window", async () => {
        const store = makeStore([makeDoc("u1", "completed", "2026-06-10T10:00:00.000Z")]);

        const result = await store.countCompletedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });
});
