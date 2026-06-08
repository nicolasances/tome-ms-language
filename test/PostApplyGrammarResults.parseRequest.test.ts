import { assert } from "chai";
import { Request } from "express";
import { PostApplyGrammarResults } from "../src/dlg/progress/PostApplyGrammarResults";

function makeReq(userId: string, body: any): Request {
    return { params: { userId }, body } as unknown as Request;
}

function makeResultPayload(overrides: { grammarConceptId?: string; result?: any } = {}) {
    return {
        grammarConceptId: overrides.grammarConceptId ?? "gc-inversion",
        result: {
            exerciseId: "ex-1",
            type: "error_correction",
            isCorrect: true,
            userAnswer: "Jeg kan ikke",
            correctAnswer: "Jeg kan ikke",
            timestamp: "2026-06-01T10:00:00.000Z",
            moduleId: "mod-1",
            ...overrides.result,
        },
    };
}

describe("PostApplyGrammarResults.parseRequest", () => {

    it("parses userId and a batch of results", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", { results: [makeResultPayload()] }));

        assert.equal(parsed.userId, "user-1");
        assert.equal(parsed.results.length, 1);
        assert.equal(parsed.results[0].grammarConceptId, "gc-inversion");
        assert.equal(parsed.results[0].result.exerciseId, "ex-1");
        assert.equal(parsed.results[0].result.isCorrect, true);
    });

    it("preserves a null moduleId on results from a level test", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", { results: [makeResultPayload({ result: { moduleId: null } })] }));

        assert.equal(parsed.results[0].result.moduleId, null);
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, body: { results: [makeResultPayload()] } } as unknown as Request), /400|userId/i);
    });

    it("throws 400 when results is missing", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("user-1", {})), /400|results/i);
    });

    it("throws 400 when results is an empty array", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [] })), /400|results/i);
    });

    it("throws 400 when an entry is missing grammarConceptId", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        const entry = makeResultPayload();
        delete (entry as any).grammarConceptId;
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [entry] })), /400|grammarConceptId/i);
    });

    it("throws 400 when an entry's result is missing required fields", () => {
        const delegate = new PostApplyGrammarResults({} as any, {} as any);
        const entry = makeResultPayload();
        delete (entry.result as any).isCorrect;
        assert.throws(() => delegate.parseRequest(makeReq("user-1", { results: [entry] })), /400|isCorrect/i);
    });
});
