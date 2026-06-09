import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeAnswer } from "../../src/model/PracticeSession";
import { PracticeSessionStore } from "../../src/store/PracticeSessionStore";

describe("PracticeSessionStore.appendAnswer", () => {

    it("pushes the answer to the session's answers array", async () => {

        const oid = new ObjectId();
        let capturedUpdate: any = null;

        const mockCollection = {
            updateOne: async (filter: any, update: any) => {
                capturedUpdate = { filter, update };
                return { matchedCount: 1 };
            },
        };

        const store = new PracticeSessionStore({ db: { collection: () => mockCollection } as any, config: {} as any });

        const answer: PracticeAnswer = {
            exerciseId: "ex-1",
            isCorrect: false,
            userAnswer: "forkert",
            answeredAt: "2026-06-09T10:00:00.000Z",
        };

        await store.appendAnswer(oid.toString(), answer);

        assert.isNotNull(capturedUpdate);
        assert.deepEqual(capturedUpdate.update.$push.answers, answer);
    });
});
