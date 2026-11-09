import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetWordsPracticeSession } from "../../../src/dlg/wordsPractice/GetWordsPracticeSession";
import { makeConfig, makeDb } from "./WordsPractice.fixtures";

function sessionDoc(oid: ObjectId, userId: string): any {
    return { _id: oid, userId, status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words: [], lastAnsweredWordKey: null };
}

describe("GetWordsPracticeSession.do", () => {

    it("returns the user's session", async () => {
        const oid = new ObjectId();
        const db = makeDb({ wordsPracticeSessions: [sessionDoc(oid, "u1")] });

        const session = await new GetWordsPracticeSession({} as any, makeConfig(db) as any).do({ userId: "u1", sessionId: oid.toString() });

        assert.equal(session.id, oid.toString());
    });

    it("throws 404 when the session does not exist", async () => {
        try {
            await new GetWordsPracticeSession({} as any, makeConfig(makeDb()) as any).do({ userId: "u1", sessionId: new ObjectId().toString() });
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 404 for another user's session", async () => {
        const oid = new ObjectId();
        const db = makeDb({ wordsPracticeSessions: [sessionDoc(oid, "u2")] });

        try {
            await new GetWordsPracticeSession({} as any, makeConfig(db) as any).do({ userId: "u1", sessionId: oid.toString() });
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});
