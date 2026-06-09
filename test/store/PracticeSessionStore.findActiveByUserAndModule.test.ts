import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSession } from "../../src/model/PracticeSession";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

function makeSessionBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

function makeMockCollection(doc: any | null) {
    return {
        findOne: async (_filter: any) => doc,
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("PracticeSessionStore.findActiveByUserAndModule", () => {

    it("returns an incomplete session (completedAt=null) for the given user+module", async () => {

        const oid = new ObjectId();
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(makeSessionBSON(oid))), config: {} as any });

        const result = await store.findActiveByUserAndModule("user-1", "mod-1");

        assert.isNotNull(result);
        assert.instanceOf(result, PracticeSession);
        assert.isNull(result!.completedAt);
    });

    it("returns null when no session exists for the user+module", async () => {

        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(null)), config: {} as any });

        const result = await store.findActiveByUserAndModule("user-1", "mod-1");

        assert.isNull(result);
    });

    it("returns null when the only session for that user+module is completed", async () => {

        const oid = new ObjectId();
        const completedDoc = makeSessionBSON(oid, { completedAt: "2026-06-09T11:00:00.000Z" });

        // The store queries with completedAt: null — mock returns null to simulate no match
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(null)), config: {} as any });

        const result = await store.findActiveByUserAndModule("user-1", "mod-1");

        assert.isNull(result);
    });
});
