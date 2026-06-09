import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.addToRetryQueue", () => {

    it("pushes the exerciseId to the retryQueue", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        await store.addToRetryQueue(oid.toString(), "ex-3");

        assert.isNotNull(capturedUpdate);
        assert.equal(capturedUpdate.update.$push.retryQueue, "ex-3");
    });
});
