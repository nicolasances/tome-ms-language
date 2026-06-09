import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.advancePosition", () => {

    it("increments currentPosition by 1", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        await store.advancePosition(oid.toString());

        assert.isNotNull(capturedUpdate);
        assert.equal(capturedUpdate.update.$inc.currentPosition, 1);
    });
});
