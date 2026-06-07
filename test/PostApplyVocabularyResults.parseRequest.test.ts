import { assert } from "chai";
import { Request } from "express";
import { PostApplyVocabularyResults } from "../src/dlg/progress/PostApplyVocabularyResults";

function makeReq(userId: string, body: any): Request {
    return { params: { userId }, body } as unknown as Request;
}

function makeResultPayload(overrides: { vocabularyItemId?: string; result?: any } = {}) {
    return {
        vocabularyItemId: overrides.vocabularyItemId ?? "A1-01-v-hund-1234",
        result: {
            exerciseId: "ex-1",
            type: "multiple_choice",
            isCorrect: true,
            userAnswer: "hund",
            correctAnswer: "hund",
            timestamp: "2026-06-01T10:00:00.000Z",
            moduleId: "mod-1",
            ...overrides.result,
        },
    };
}

describe("PostApplyVocabularyResults.parseRequest", () => {

    it("parses userId and a batch of results", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", { results: [makeResultPayload()] }));

        assert.equal(parsed.userId, "user-1");
        assert.equal(parsed.results.length, 1);
        assert.equal(parsed.results[0].vocabularyItemId, "A1-01-v-hund-1234");
        assert.equal(parsed.results[0].result.exerciseId, "ex-1");
        assert.equal(parsed.results[0].result.isCorrect, true);
    });

    it("preserves a null moduleId on results from a level test", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", { results: [makeResultPayload({ result: { moduleId: null } })] }));

        assert.equal(parsed.results[0].result.moduleId, null);
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, body: { results: [makeResultPayload()] } } as unknown as Request), /400|userId/i);
    });

    it("throws 400 when results is missing", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("user-1", {})), /400|results/i);
    });

    it("throws 400 when results is an empty array", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [] })), /400|results/i);
    });

    it("throws 400 when an entry is missing vocabularyItemId", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        const entry = makeResultPayload();
        delete (entry as any).vocabularyItemId;
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [entry] })), /400|vocabularyItemId/i);
    });

    it("throws 400 when an entry's result is missing required fields", () => {
        const delegate = new PostApplyVocabularyResults({} as any, {} as any);
        const entry = makeResultPayload();
        delete (entry.result as any).isCorrect;
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [entry] })), /400|isCorrect/i);
    });
});
