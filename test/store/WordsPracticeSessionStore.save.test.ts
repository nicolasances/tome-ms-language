import { assert } from "chai";
import { ObjectId } from "mongodb";
import { WordsPracticeSession } from "../../src/model/WordsPracticeSession";
import { WordsPracticeSessionStore } from "../../src/store/WordsPracticeSessionStore";
import { FakeDb } from "../helpers/FakeDb";

describe("WordsPracticeSessionStore.save", () => {

    it("replaces the stored session with the given state", async () => {
        const oid = new ObjectId();
        const base = new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words: [], lastAnsweredWordKey: null });
        const db = new FakeDb({ wordsPracticeSessions: [{ ...base.toBSON(), _id: oid }] });
        const store = new WordsPracticeSessionStore({ db: db as any, config: {} as any });
        const session = (await store.findById(oid.toString()))!;

        session.status = "completed";
        session.completedAt = "2026-11-08T09:30:00.000Z";
        await store.save(session);

        const stored = db.collections["wordsPracticeSessions"][0];

        assert.equal(stored.status, "completed");
        assert.equal(stored.completedAt, "2026-11-08T09:30:00.000Z");
        assert.equal(db.collections["wordsPracticeSessions"].length, 1);
    });
});
