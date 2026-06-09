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

describe("PracticeSessionStore.findById", () => {

    it("returns the session when found", async () => {

        const oid = new ObjectId();
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(makeSessionBSON(oid))), config: {} as any });

        const result = await store.findById(oid.toString());

        assert.isNotNull(result);
        assert.instanceOf(result, PracticeSession);
        assert.equal(result!.id, oid.toString());
        assert.equal(result!.userId, "user-1");
    });

    it("returns null when not found", async () => {

        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(null)), config: {} as any });

        const result = await store.findById(new ObjectId().toString());

        assert.isNull(result);
    });
});
