import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSession } from "../../src/model/PracticeSession";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

function makeSession(): PracticeSession {
    return new PracticeSession({
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
    });
}

function makeMockCollection(insertedId = new ObjectId()) {
    return {
        insertOne: async (_doc: any) => ({ insertedId }),
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("PracticeSessionStore.create", () => {

    it("inserts the session and returns the inserted _id as a string", async () => {

        const oid = new ObjectId();
        const store = new PracticeSessionStore({ db: makeMockDb(makeMockCollection(oid)), config: {} as any });

        const result = await store.create(makeSession());

        assert.equal(result, oid.toString());
    });
});
