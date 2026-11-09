import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PostWordsPracticeSession } from "../../../src/dlg/wordsPractice/PostWordsPracticeSession";
import { makeConfig, makeDb, moduleDoc, moduleProgressDoc, vocabDoc, vocabProgressDoc } from "./WordsPractice.fixtures";

function delegate(db: any) {
    return new PostWordsPracticeSession({} as any, makeConfig(db) as any);
}

function completedModuleDb(wordCount: number, extra: Record<string, any[]> = {}) {
    const ids = Array.from({ length: wordCount }, (_, i) => `v${i}`);

    return makeDb({
        modules: [moduleDoc("m1", ids)],
        vocabulary: ids.map((id, i) => vocabDoc(id, `ord${i}`)),
        userModuleProgress: [moduleProgressDoc("m1", "completed")],
        ...extra,
    });
}

describe("PostWordsPracticeSession.parseRequest", () => {

    it("requires userId", () => {
        assert.throws(() => delegate(makeDb()).parseRequest({ params: {} } as any));
    });
});

describe("PostWordsPracticeSession.do", () => {

    it("throws 400 emptyPool when no module is completed", async () => {
        const db = makeDb({ modules: [moduleDoc("m1", ["v1"])], vocabulary: [vocabDoc("v1", "hus")], userModuleProgress: [moduleProgressDoc("m1", "in_progress")] });

        try {
            await delegate(db).do({ userId: "u1" });
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 400);
            assert.equal(err.reason, "emptyPool");
        }
    });

    it("throws 409 with the open sessionId and creates nothing", async () => {
        const oid = new ObjectId();
        const db = completedModuleDb(3, { wordsPracticeSessions: [{ _id: oid, userId: "u1", status: "in_progress", startedAt: "x", completedAt: null, words: [], lastAnsweredWordKey: null }] });

        try {
            await delegate(db).do({ userId: "u1" });
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 409);
            assert.equal(err.sessionId, oid.toString());
        }

        assert.lengthOf(db.collections["wordsPracticeSessions"], 1);
    });

    it("creates an in_progress session with min(40, poolSize) distinct words", async () => {
        const db = completedModuleDb(55);

        const session = await delegate(db).do({ userId: "u1" });

        assert.equal(session.status, "in_progress");
        assert.lengthOf(session.words, 40);
        assert.lengthOf(new Set(session.words.map(w => w.wordKey)), 40);
        assert.lengthOf(db.collections["wordsPracticeSessions"], 1);
    });

    it("uses the whole pool when it is smaller than the session size", async () => {
        const session = await delegate(completedModuleDb(5)).do({ userId: "u1" });

        assert.lengthOf(session.words, 5);
    });

    it("snapshots the prompt and gives every word a fresh answer state", async () => {
        const db = makeDb({
            modules: [moduleDoc("m1", ["v1", "v2"])],
            vocabulary: [vocabDoc("v1", "et hus", { english: "house", context: "ctx" }), vocabDoc("v2", "hus")],
            userModuleProgress: [moduleProgressDoc("m1", "completed")],
            userVocabularyProgress: [vocabProgressDoc("v1", 0.5)],
        });

        const session = await delegate(db).do({ userId: "u1" });
        const word = session.words[0];

        assert.equal(session.words.length, 1);
        assert.equal(word.wordKey, "hus");
        assert.sameMembers(word.vocabularyItemIds, ["v1", "v2"]);
        assert.equal(word.promptItemId, "v1");
        assert.equal(word.english, "house");
        assert.equal(word.danish, "et hus");
        assert.deepEqual(word.attempts, []);
        assert.isNull(word.firstAttemptCorrect);
        assert.isFalse(word.correct);
        assert.isFalse(word.firstAttemptResultApplied);
        assert.isNull(session.lastAnsweredWordKey);
        assert.isNull(session.completedAt);
    });

    it("returns the id of the created session", async () => {
        const db = completedModuleDb(2);

        const session = await delegate(db).do({ userId: "u1" });

        assert.equal(session.id, db.collections["wordsPracticeSessions"][0]._id.toString());
    });
});
