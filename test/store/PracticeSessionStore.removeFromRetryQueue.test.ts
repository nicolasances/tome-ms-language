import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.removeFromRetryQueue", () => {

    it("pulls the exerciseId from the retryQueue", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        await store.removeFromRetryQueue(oid.toString(), "ex-4");

        assert.isNotNull(capturedUpdate);
        assert.equal(capturedUpdate.update.$pull.retryQueue, "ex-4");
    });

    it("is a no-op (does not throw) when the exerciseId is not in the queue", async () => {

        const oid = new ObjectId();
        let callCount = 0;

        const mockCollection = {
            updateOne: async (_filter: any, _update: any) => {
                callCount++;
                return { matchedCount: 0 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        await store.removeFromRetryQueue(oid.toString(), "ex-unknown");

        assert.equal(callCount, 1);
    });
});
