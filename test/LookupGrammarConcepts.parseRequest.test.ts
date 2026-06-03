import { assert } from "chai";
import { Request } from "express";
import { LookupGrammarConcepts } from "../src/dlg/grammar/LookupGrammarConcepts";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

describe("LookupGrammarConcepts.parseRequest", () => {

    it("parses a valid ids array", () => {

        const delegate = new LookupGrammarConcepts({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ids: ["ID-1", "ID-2"] }));

        assert.deepEqual(parsed.ids, ["ID-1", "ID-2"]);
    });

    it("throws 400 when ids is missing", () => {

        const delegate = new LookupGrammarConcepts({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /ids/i);
    });

    it("throws 400 when ids is an empty array", () => {

        const delegate = new LookupGrammarConcepts({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ids: [] })), /ids/i);
    });

});

