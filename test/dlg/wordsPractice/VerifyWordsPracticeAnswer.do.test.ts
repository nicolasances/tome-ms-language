import { assert } from "chai";
import { ObjectId } from "mongodb";
import { VerifyWordsPracticeAnswer } from "../../../src/dlg/wordsPractice/VerifyWordsPracticeAnswer";
import { WordsPracticeAttempt, WordsPracticeSession, WordsPracticeWord } from "../../../src/model/WordsPracticeSession";
import { VertexAIClient } from "../../../src/ai/VertexAIClient";
import { FakeDb } from "../../helpers/FakeDb";
import { makeConfig, makeDb } from "./WordsPractice.fixtures";

interface WordOptions {
    attempts: { userAnswer: string; isCorrect: boolean; aiChecked?: boolean }[];
    firstAttemptCorrect?: boolean | null;
    firstAttemptResultApplied?: boolean;
    correct?: boolean;
}

function word(wordKey: string, ids: string[], danish: string, opts: WordOptions): WordsPracticeWord {
    const attempts = opts.attempts.map((a, i) => new WordsPracticeAttempt({ userAnswer: a.userAnswer, isCorrect: a.isCorrect, isFirstAttempt: i === 0, aiChecked: a.aiChecked ?? false, timestamp: "2026-11-08T09:00:00.000Z" }));

    return new WordsPracticeWord({
        wordKey, vocabularyItemIds: ids, promptItemId: ids[0], english: "large", type: "adjective", context: "size", danish, attempts,
        firstAttemptCorrect: opts.firstAttemptCorrect ?? (attempts.length ? attempts[0].isCorrect : null),
        correct: opts.correct ?? false,
        firstAttemptResultApplied: opts.firstAttemptResultApplied ?? false,
    });
}

/** A session whose most recent answer is the given word, by default a wrong first attempt "stor" -> "kæmpe". */
function setup(words: WordsPracticeWord[], overrides: any = {}): { db: FakeDb; sessionId: string } {
    const oid = new ObjectId();
    const session = new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null, words, lastAnsweredWordKey: words[0].wordKey });

    return { db: makeDb({ wordsPracticeSessions: [{ ...session.toBSON(), ...overrides, _id: oid }], vocabularyItems: [] }), sessionId: oid.toString() };
}

function wrongFirstAttempt(): WordsPracticeWord {
    return word("stor", ["v1", "v2"], "stor", { attempts: [{ userAnswer: "kæmpe", isCorrect: false }] });
}

function mockAI(responses: (string | Error)[], prompts: string[] = []): VertexAIClient {
    let i = 0;
    return {
        generate: async (prompt: string) => {
            prompts.push(prompt);
            const r = responses[Math.min(i++, responses.length - 1)];
            if (r instanceof Error) throw r;
            return r;
        }
    };
}

function verify(db: FakeDb, sessionId: string, ai: VertexAIClient, wordKey = "stor", userId = "u1") {
    const delegate = new VerifyWordsPracticeAnswer({} as any, makeConfig(db) as any);
    delegate.aiClient = ai;
    return delegate.do({ userId, sessionId, wordKey, cefrLevel: "A1" });
}

function stored(db: FakeDb): any {
    return db.collections["wordsPracticeSessions"][0];
}

function history(db: FakeDb, itemId: string): any[] {
    return (db.collections["userVocabularyProgress"] ?? []).find(d => d.vocabularyItemId === itemId)?.exerciseHistory ?? [];
}

async function expectError(promise: Promise<any>, code: number) {
    try {
        await promise;
        assert.fail("expected error");
    } catch (err: any) {
        assert.equal(err.code, code);
    }
}

describe("VerifyWordsPracticeAnswer.parseRequest", () => {

    const delegate = new VerifyWordsPracticeAnswer({} as any, {} as any);

    it("extracts the route params and body", () => {
        const parsed = delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { wordKey: "stor", cefrLevel: "A2" } } as any);

        assert.deepEqual(parsed, { userId: "u1", sessionId: "s1", wordKey: "stor", cefrLevel: "A2" });
    });

    it("requires wordKey and cefrLevel", () => {
        assert.throws(() => delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { cefrLevel: "A1" } } as any));
        assert.throws(() => delegate.parseRequest({ params: { userId: "u1", sessionId: "s1" }, body: { wordKey: "stor" } } as any));
    });
});

describe("VerifyWordsPracticeAnswer.do", () => {

    it("valid verdict on a wrong first attempt makes the word correct and writes one correct result per group item", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        const res = await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: true }), JSON.stringify({})]));

        const w = stored(db).words[0];
        assert.isTrue(res.valid);
        assert.isTrue(w.correct);
        assert.isTrue(w.firstAttemptCorrect);
        assert.isTrue(w.firstAttemptResultApplied);
        assert.isTrue(w.attempts[0].isCorrect);
        assert.isTrue(w.attempts[0].aiChecked);
        for (const id of ["v1", "v2"]) {
            assert.lengthOf(history(db, id), 1);
            assert.isTrue(history(db, id)[0].isCorrect);
            assert.equal(history(db, id)[0].type, "words_practice");
        }
    });

    it("invalid verdict on a wrong first attempt returns the explanation and writes one incorrect result per group item", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        const res = await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: false, explanation: "Not Danish for large" })]));

        const w = stored(db).words[0];
        assert.deepEqual(res, { valid: false, explanation: "Not Danish for large" });
        assert.isFalse(w.correct);
        assert.isFalse(w.firstAttemptCorrect);
        assert.isTrue(w.firstAttemptResultApplied);
        assert.isTrue(w.attempts[0].aiChecked);
        for (const id of ["v1", "v2"]) {
            assert.lengthOf(history(db, id), 1);
            assert.isFalse(history(db, id)[0].isCorrect);
        }
    });

    it("valid verdict on a retry changes correctness only, with no mastery write", async () => {
        const w = word("stor", ["v1"], "stor", {
            attempts: [{ userAnswer: "lille", isCorrect: false }, { userAnswer: "kæmpe", isCorrect: false }],
            firstAttemptCorrect: false, firstAttemptResultApplied: true,
        });
        const { db, sessionId } = setup([w]);

        await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: true }), JSON.stringify({})]));

        const saved = stored(db).words[0];
        assert.isTrue(saved.correct);
        assert.isFalse(saved.firstAttemptCorrect);
        assert.isTrue(saved.attempts[1].isCorrect);
        assert.isTrue(saved.attempts[1].aiChecked);
        assert.lengthOf(history(db, "v1"), 0);
    });

    it("invalid verdict on a retry writes nothing to mastery", async () => {
        const w = word("stor", ["v1"], "stor", {
            attempts: [{ userAnswer: "lille", isCorrect: false }, { userAnswer: "kæmpe", isCorrect: false }],
            firstAttemptCorrect: false, firstAttemptResultApplied: true,
        });
        const { db, sessionId } = setup([w]);

        await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: false, explanation: "no" })]));

        assert.isFalse(stored(db).words[0].correct);
        assert.lengthOf(history(db, "v1"), 0);
    });

    it("rejects a second check of the same attempt with 409", async () => {
        const w = word("stor", ["v1"], "stor", { attempts: [{ userAnswer: "kæmpe", isCorrect: false, aiChecked: true }], firstAttemptResultApplied: true });
        const { db, sessionId } = setup([w]);

        await expectError(verify(db, sessionId, mockAI(["{}"])), 409);
    });

    it("rejects a word that is not the most recent answer with 400", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt(), word("hus", ["v3"], "hus", { attempts: [] })]);

        await expectError(verify(db, sessionId, mockAI(["{}"]), "hus"), 400);
    });

    it("rejects a correct most recent attempt with 400", async () => {
        const w = word("stor", ["v1"], "stor", { attempts: [{ userAnswer: "stor", isCorrect: true }], correct: true, firstAttemptResultApplied: true });
        const { db, sessionId } = setup([w]);

        await expectError(verify(db, sessionId, mockAI(["{}"])), 400);
    });

    it("rejects a completed session with 400", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()], { status: "completed" });

        await expectError(verify(db, sessionId, mockAI(["{}"])), 400);
    });

    it("rejects another user's session with 404", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        await expectError(verify(db, sessionId, mockAI(["{}"]), "stor", "u2"), 404);
    });

    it("never shows the canonical danish in the verdict prompt but shows the answer, english and level", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);
        const prompts: string[] = [];

        await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: false, explanation: "x" })], prompts));

        assert.lengthOf(prompts, 1);
        assert.notInclude(prompts[0].toLowerCase(), "stor");
        assert.include(prompts[0], "kæmpe");
        assert.include(prompts[0], "large");
        assert.include(prompts[0], "A1");
    });

    it("adds the note from the second step, which does see the canonical danish", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);
        const prompts: string[] = [];

        const res = await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: true }), JSON.stringify({ explanation: "Correct — the module used stor" })], prompts));

        assert.deepEqual(res, { valid: true, explanation: "Correct — the module used stor" });
        assert.include(prompts[1], "stor");
    });

    it("stays valid without explanation when the note step fails", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        const res = await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: true }), new Error("boom")]));

        assert.deepEqual(res, { valid: true });
        assert.isTrue(stored(db).words[0].correct);
    });

    it("on AI failure leaves the attempt unchecked and the pending write unmade", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        try {
            await verify(db, sessionId, mockAI([new Error("timeout")]));
            assert.fail("expected error");
        } catch (err: any) {
            assert.equal(err.message, "timeout");
        }

        const w = stored(db).words[0];
        assert.isFalse(w.attempts[0].aiChecked);
        assert.isFalse(w.firstAttemptResultApplied);
        assert.isFalse(w.correct);
        assert.lengthOf(history(db, "v1"), 0);
    });

    it("does not modify any vocabulary item or exercise", async () => {
        const { db, sessionId } = setup([wrongFirstAttempt()]);

        await verify(db, sessionId, mockAI([JSON.stringify({ reasoning: "r", valid: true }), JSON.stringify({})]));

        assert.deepEqual(db.collections["vocabularyItems"] ?? [], []);
        assert.deepEqual(db.collections["exercises"] ?? [], []);
    });
});
