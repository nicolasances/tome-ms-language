import { assert } from "chai";
import { Request } from "express";
import { GetGrammarConcept } from "../src/dlg/grammar/GetGrammarConcept";

function makeReq(params: Record<string, any>): Request {
    return { params, body: {}, query: {} } as unknown as Request;
}

describe("GetGrammarConcept.parseRequest", () => {

    it("parses id from route params", () => {

        const delegate = new GetGrammarConcept({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "A1-01-g-present-tense-6604" }));

        assert.equal(parsed.id, "A1-01-g-present-tense-6604");
    });

    it("throws 400 when id param is missing", () => {

        const delegate = new GetGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /id/i);
    });

});

