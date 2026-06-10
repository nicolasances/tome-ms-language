import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.addVerifiedExerciseId", () => {

    it("pushes the exerciseId into the verifiedExerciseIds array", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        await store.addVerifiedExerciseId(oid.toString(), "ex-7");

        assert.isNotNull(capturedUpdate);
        assert.equal(capturedUpdate.update.$push.verifiedExerciseIds, "ex-7");
    });
});
