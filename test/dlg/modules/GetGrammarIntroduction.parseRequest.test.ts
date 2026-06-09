import { assert } from "chai";
import { Request } from "express";
import { GetGrammarIntroduction } from "../../../src/dlg/modules/GetGrammarIntroduction";

function makeReq(params: Record<string, any>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetGrammarIntroduction.parseRequest", () => {

    it("parses moduleId from route params", () => {

        const delegate = new GetGrammarIntroduction({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "danish-A1-01" }));

        assert.equal(parsed.moduleId, "danish-A1-01");
    });

    it("throws 400 when moduleId param is missing", () => {

        const delegate = new GetGrammarIntroduction({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /moduleId/i);
    });

});
