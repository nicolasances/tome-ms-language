import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.complete", () => {

    it("sets completedAt on the session", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        const completedAt = "2026-06-09T11:00:00.000Z";
        await store.complete(oid.toString(), completedAt);

        assert.isNotNull(capturedUpdate);
        assert.equal(capturedUpdate.update.$set.completedAt, completedAt);
    });
});
