import { assert } from "chai";
import { Request } from "express";
import { GetGrammarConcepts } from "../src/dlg/grammar/GetGrammarConcepts";

function makeReq(query: Record<string, any>): Request {
    return { params: {}, body: {}, query } as unknown as Request;
}

describe("GetGrammarConcepts.parseRequest", () => {

    it("returns empty object when no query params are given", () => {

        const delegate = new GetGrammarConcepts({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({}));

        assert.isUndefined(parsed.cefrLevel);
        assert.isUndefined(parsed.category);
    });

    it("parses a valid cefrLevel query param", () => {

        const delegate = new GetGrammarConcepts({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "B1" }));

        assert.equal(parsed.cefrLevel, "B1");
    });

    it("parses a valid category query param", () => {

        const delegate = new GetGrammarConcepts({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ category: "tenses" }));

        assert.equal(parsed.category, "tenses");
    });

    it("throws 400 for an invalid cefrLevel", () => {

        const delegate = new GetGrammarConcepts({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" })), /cefrLevel/i);
    });

    it("throws 400 for an invalid category", () => {

        const delegate = new GetGrammarConcepts({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ category: "galaxy-brain" })), /category/i);
    });

});

