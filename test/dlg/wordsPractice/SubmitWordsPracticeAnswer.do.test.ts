import { assert } from "chai";
import { ObjectId } from "mongodb";
import { SubmitWordsPracticeAnswer } from "../../../src/dlg/wordsPractice/SubmitWordsPracticeAnswer";
import { WordsPracticeSession, WordsPracticeWord } from "../../../src/model/WordsPracticeSession";
import { FakeDb } from "../../helpers/FakeDb";
import { makeConfig, makeDb } from "./WordsPractice.fixtures";

function word(wordKey: string, ids: string[], danish = wordKey): WordsPracticeWord {
    return new WordsPracticeWord({ wordKey, vocabularyItemIds: ids, promptItemId: ids[0], english: `en-${wordKey}`, type: "noun", context: null, danish, attempts: [], firstAttemptCorrect: null, correct: false, firstAttemptResultApplied: false });
}

function sessionDb(words: WordsPracticeWord[], overrides: any = {}): { db: FakeDb; sessionId: string } {
    const oid = new ObjectId();
    const session = new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words, lastAnsweredWordKey: null });

    return { db: makeDb({ wordsPracticeSessions: [{ ...session.toBSON(), ...overrides, _id: oid }] }), sessionId: oid.toString() };
}

function submit(db: FakeDb, sessionId: string, wordKey: string, userAnswer: string, userId = "u1") {
    return new SubmitWordsPracticeAnswer({} as any, makeConfig(db) as any).do({ userId, sessionId, wordKey, userAnswer });
}

function stored(db: FakeDb): any {
    return db.collections["wordsPracticeSessions"][0];
}

function history(db: FakeDb, itemId: string): any[] {
    return (db.collections["userVocabularyProgress"] ?? []).find(d => d.vocabularyItemId === itemId)?.exerciseHistory ?? [];
}

describe("SubmitWordsPracticeAnswer.parseRequest", () => {

    const delegate = new SubmitWordsPracticeAnswer({} as any, {} as any);

    it("extracts the route params and body", () => {
        const parsed = delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { wordKey: "hus", userAnswer: "hus" } } as any);

        assert.deepEqual(parsed, { userId: "u1", sessionId: "s1", wordKey: "hus", userAnswer: "hus" });
    });

    it("requires wordKey and userAnswer", () => {
        assert.throws(() => delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { userAnswer: "hus" } } as any));
        assert.throws(() => delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { wordKey: "hus" } } as any));
    });
});

describe("SubmitWordsPracticeAnswer.do", () => {

    it("rejects with 404 for another user's session", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        try {
            await submit(db, sessionId, "hus", "hus", "u2");
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("rejects with 400 when the word is not in the session", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        try {
            await submit(db, sessionId, "bil", "bil");
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("rejects with 400 when the session is completed", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])], { status: "completed" });

        try {
            await submit(db, sessionId, "hus", "hus");
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("rejects with 400 when the word is already answered correctly", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        await submit(db, sessionId, "hus", "hus");

        try {
            await submit(db, sessionId, "hus", "hus");
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("returns the verdict, the canonical answer and whether it was a first attempt", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"], "et hus")]);

        const result = await submit(db, sessionId, "hus", "Hus.");

        assert.deepEqual(result, { isCorrect: true, correctAnswer: "et hus", isFirstAttempt: true });
    });

    it("records the attempt, marks the word correct and remembers the last answered word", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"]), word("bil", ["v2"])]);

        await submit(db, sessionId, "hus", "hus");

        const saved = stored(db);

        assert.isTrue(saved.words[0].correct);
        assert.isTrue(saved.words[0].firstAttemptCorrect);
        assert.deepInclude(saved.words[0].attempts[0], { userAnswer: "hus", isCorrect: true, isFirstAttempt: true, aiChecked: false });
        assert.equal(saved.lastAnsweredWordKey, "hus");
    });

    it("writes a correct first attempt to every item of the group immediately", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1", "v2"])]);

        await submit(db, sessionId, "hus", "hus");

        assert.lengthOf(history(db, "v1"), 1);
        assert.lengthOf(history(db, "v2"), 1);
        assert.deepInclude(history(db, "v1")[0], { type: "words_practice", exerciseId: null, moduleId: null, isCorrect: true });
        assert.isTrue(stored(db).words[0].firstAttemptResultApplied);
    });

    it("keeps a wrong first attempt pending: no mastery write, word not correct", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        const result = await submit(db, sessionId, "hus", "bil");

        assert.isFalse(result.isCorrect);
        assert.deepEqual(db.collections["userVocabularyProgress"] ?? [], []);
        assert.isFalse(stored(db).words[0].correct);
        assert.isFalse(stored(db).words[0].firstAttemptCorrect);
        assert.isFalse(stored(db).words[0].firstAttemptResultApplied);
    });

    it("finalizes the pending wrong first attempt as incorrect when the next answer arrives, exactly once", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"]), word("bil", ["v2"])]);

        await submit(db, sessionId, "hus", "bil");
        await submit(db, sessionId, "bil", "bil");
        await submit(db, sessionId, "hus", "hus");

        assert.lengthOf(history(db, "v1"), 1);
        assert.isFalse(history(db, "v1")[0].isCorrect);
        assert.isTrue(stored(db).words[0].firstAttemptResultApplied);
    });

    it("finalizes the pending attempt when the same word is retried, and the retry writes nothing", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        await submit(db, sessionId, "hus", "bil");
        const retry = await submit(db, sessionId, "hus", "hus");

        assert.isFalse(retry.isFirstAttempt);
        assert.isTrue(retry.isCorrect);
        assert.lengthOf(history(db, "v1"), 1);
        assert.isFalse(history(db, "v1")[0].isCorrect);
        assert.isTrue(stored(db).words[0].correct);
        assert.isFalse(stored(db).words[0].firstAttemptCorrect);
    });

    it("does not write mastery for further wrong retries", async () => {
        const { db, sessionId } = sessionDb([word("hus", ["v1"])]);

        await submit(db, sessionId, "hus", "bil");
        await submit(db, sessionId, "hus", "bil");
        await submit(db, sessionId, "hus", "bil");

        assert.lengthOf(history(db, "v1"), 1);
        assert.lengthOf(stored(db).words[0].attempts, 3);
    });
});
