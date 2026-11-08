import { assert } from "chai";
import { ObjectId } from "mongodb";
import { CompleteWordsPracticeSession } from "../../../src/dlg/wordsPractice/CompleteWordsPracticeSession";
import { WordsPracticeAttempt, WordsPracticeSession, WordsPracticeWord } from "../../../src/model/WordsPracticeSession";
import { FakeDb } from "../../helpers/FakeDb";
import { makeConfig, makeDb } from "./WordsPractice.fixtures";

function attempt(userAnswer: string, isCorrect: boolean, isFirstAttempt: boolean): WordsPracticeAttempt {
    return new WordsPracticeAttempt({ userAnswer, isCorrect, isFirstAttempt, aiChecked: false, timestamp: "2026-11-08T09:10:00.000Z" });
}

function word(wordKey: string, ids: string[], overrides: Partial<ConstructorParameters<typeof WordsPracticeWord>[0]> = {}): WordsPracticeWord {
    return new WordsPracticeWord({ wordKey, vocabularyItemIds: ids, promptItemId: ids[0], english: `en-${wordKey}`, type: "noun", context: null, danish: wordKey, attempts: [], firstAttemptCorrect: null, correct: false, firstAttemptResultApplied: false, ...overrides });
}

function correctWord(wordKey: string, ids: string[]): WordsPracticeWord {
    return word(wordKey, ids, { attempts: [attempt(wordKey, true, true)], firstAttemptCorrect: true, correct: true, firstAttemptResultApplied: true });
}

function sessionDb(words: WordsPracticeWord[], overrides: any = {}): { db: FakeDb; sessionId: string } {
    const oid = new ObjectId();
    const session = new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words, lastAnsweredWordKey: null });

    return { db: makeDb({ wordsPracticeSessions: [{ ...session.toBSON(), ...overrides, _id: oid }] }), sessionId: oid.toString() };
}

function complete(db: FakeDb, sessionId: string, userId = "u1") {
    return new CompleteWordsPracticeSession({} as any, makeConfig(db) as any).do({ userId, sessionId });
}

describe("CompleteWordsPracticeSession.parseRequest", () => {

    it("extracts userId and sessionId and requires both", () => {
        const delegate = new CompleteWordsPracticeSession({} as any, {} as any);

        assert.deepEqual(delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" } } as any), { userId: "u1", sessionId: "s1" });
        assert.throws(() => delegate.parseRequest({ params: { userId: "u1" } } as any));
        assert.throws(() => delegate.parseRequest({ params: { sessionId: "s1" } } as any));
    });
});

describe("CompleteWordsPracticeSession.do", () => {

    it("throws 404 for another user's session", async () => {
        const { db, sessionId } = sessionDb([correctWord("hus", ["v1"])]);

        try {
            await complete(db, sessionId, "u2");
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 400 with outstandingWordKeys while words are not yet correct, and changes nothing", async () => {
        const { db, sessionId } = sessionDb([correctWord("hus", ["v1"]), word("bil", ["v2"]), word("kat", ["v3"], { attempts: [attempt("x", false, true)], firstAttemptCorrect: false })]);

        try {
            await complete(db, sessionId);
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.code, 400);
            assert.sameMembers(err.outstandingWordKeys, ["bil", "kat"]);
        }

        assert.equal(db.collections["wordsPracticeSessions"][0].status, "in_progress");
        assert.deepEqual(db.collections["userVocabularyProgress"] ?? [], []);
    });

    it("sets status completed and completedAt, and returns the session", async () => {
        const { db, sessionId } = sessionDb([correctWord("hus", ["v1"])]);

        const result = await complete(db, sessionId);

        assert.equal(result.status, "completed");
        assert.isString(result.completedAt);
        assert.equal(db.collections["wordsPracticeSessions"][0].status, "completed");
        assert.equal(db.collections["wordsPracticeSessions"][0].completedAt, result.completedAt);
    });

    it("finalizes a pending wrong first attempt as incorrect, once", async () => {
        const pending = word("hus", ["v1", "v2"], {
            attempts: [attempt("huus", false, true), attempt("hus", true, false)],
            firstAttemptCorrect: false,
            correct: true,
        });
        const { db, sessionId } = sessionDb([pending]);

        await complete(db, sessionId);

        const docs = db.collections["userVocabularyProgress"];

        assert.sameMembers(docs.map(d => d.vocabularyItemId), ["v1", "v2"]);
        assert.lengthOf(docs[0].exerciseHistory, 1);
        assert.deepInclude(docs[0].exerciseHistory[0], { type: "words_practice", exerciseId: null, moduleId: null, isCorrect: false, userAnswer: "huus" });
        assert.isTrue(db.collections["wordsPracticeSessions"][0].words[0].firstAttemptResultApplied);
    });

    it("is idempotent on an already-completed session: returns it unchanged and writes nothing", async () => {
        const { db, sessionId } = sessionDb([correctWord("hus", ["v1"])], { status: "completed", completedAt: "2026-11-08T09:30:00.000Z" });

        const result = await complete(db, sessionId);

        assert.equal(result.status, "completed");
        assert.equal(result.completedAt, "2026-11-08T09:30:00.000Z");
        assert.deepEqual(db.collections["userVocabularyProgress"] ?? [], []);
    });
});
