import { assert } from "chai";
import { ObjectId } from "mongodb";
import { WordsPracticeSession } from "../../src/model/WordsPracticeSession";
import { WordsPracticeSessionStore } from "../../src/store/WordsPracticeSessionStore";
import { FakeDb } from "../helpers/FakeDb";

function makeSession(overrides: Partial<ConstructorParameters<typeof WordsPracticeSession>[0]> = {}): WordsPracticeSession {
    return new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words: [], lastAnsweredWordKey: null, ...overrides });
}

describe("WordsPracticeSessionStore", () => {

    it("create inserts the session and returns the generated id", async () => {
        const db = new FakeDb();
        const store = new WordsPracticeSessionStore({ db: db as any, config: {} as any });

        const id = await store.create(makeSession());

        assert.equal(db.collections["wordsPracticeSessions"][0]._id.toString(), id);
    });

    it("findById returns the session, or null when absent", async () => {
        const oid = new ObjectId();
        const db = new FakeDb({ wordsPracticeSessions: [{ ...makeSession().toBSON(), _id: oid }] });
        const store = new WordsPracticeSessionStore({ db: db as any, config: {} as any });

        assert.equal((await store.findById(oid.toString()))!.id, oid.toString());
        assert.isNull(await store.findById(new ObjectId().toString()));
    });

    it("findInProgressByUser returns only the user's in_progress session", async () => {
        const open = new ObjectId();
        const db = new FakeDb({
            wordsPracticeSessions: [
                { ...makeSession({ status: "completed" }).toBSON(), _id: new ObjectId() },
                { ...makeSession({ userId: "u2" }).toBSON(), _id: new ObjectId() },
                { ...makeSession().toBSON(), _id: open },
            ],
        });
        const store = new WordsPracticeSessionStore({ db: db as any, config: {} as any });

        assert.equal((await store.findInProgressByUser("u1"))!.id, open.toString());
        assert.isNull(await store.findInProgressByUser("u3"));
    });
});
