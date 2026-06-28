import { assert } from "chai";
import { ObjectId } from "mongodb";
import { LevelTestAttemptStore } from "../../src/store/LevelTestAttemptStore";

const TZ = "Europe/Copenhagen";

function makeDoc(userId: string, passed: boolean | null, takenAt: string | null): any {
    return { _id: new ObjectId(), userId, cefrLevel: "A1", passed, takenAt };
}

function makeMockCollection(initialDocs: any[]) {
    const docs = [...initialDocs];
    return {
        find: (filter: any) => ({
            toArray: async () => {
                return docs.filter(d => {
                    if (d.userId !== filter.userId) return false;
                    if (filter.passed !== undefined && d.passed !== filter.passed) return false;
                    const ta = d.takenAt;
                    if (!ta) return false;
                    if (filter.takenAt?.$gte && ta < filter.takenAt.$gte) return false;
                    if (filter.takenAt?.$lte && ta > filter.takenAt.$lte) return false;
                    return true;
                });
            },
        }),
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("LevelTestAttemptStore.countPassedByDay", () => {

    it("counts passed attempts bucketed by calendar day in the reference timezone", async () => {
        const docs = [
            makeDoc("u1", true, "2026-06-21T10:00:00.000Z"),
            makeDoc("u1", true, "2026-06-22T08:00:00.000Z"),
            makeDoc("u1", true, "2026-06-22T20:00:00.000Z"),
        ];
        const store = new LevelTestAttemptStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countPassedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 1);
        assert.equal(result.get("20260622"), 2);
        assert.isUndefined(result.get("20260623"));
    });

    it("excludes failed attempts", async () => {
        const docs = [
            makeDoc("u1", false, "2026-06-21T10:00:00.000Z"),
            makeDoc("u1", true, "2026-06-21T11:00:00.000Z"),
        ];
        const store = new LevelTestAttemptStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countPassedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 1);
    });

    it("excludes un-submitted attempts with null takenAt", async () => {
        const docs = [
            makeDoc("u1", null, null),
            makeDoc("u1", true, "2026-06-21T10:00:00.000Z"),
        ];
        const store = new LevelTestAttemptStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countPassedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.get("20260621"), 1);
    });

    it("excludes attempts belonging to a different user", async () => {
        const docs = [makeDoc("u2", true, "2026-06-21T10:00:00.000Z")];
        const store = new LevelTestAttemptStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countPassedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });

    it("returns an empty map when no attempts fall in the window", async () => {
        const docs = [makeDoc("u1", true, "2026-06-10T10:00:00.000Z")];
        const store = new LevelTestAttemptStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        const result = await store.countPassedByDay("u1", "20260621", "20260627", TZ);

        assert.equal(result.size, 0);
    });
});
