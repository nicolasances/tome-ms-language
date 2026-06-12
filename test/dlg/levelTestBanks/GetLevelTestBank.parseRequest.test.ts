import { assert } from "chai";
import { Request } from "express";
import { GetLevelTestBank } from "../../../src/dlg/levelTestBanks/GetLevelTestBank";

function makeReq(params: any): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetLevelTestBank.parseRequest", () => {

    it("parses a valid cefrLevel from path params", () => {

        const delegate = new GetLevelTestBank({} as any, {} as any);

        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "B2" }));

        assert.equal(parsed.cefrLevel, "B2");
    });

    it("throws 400 when cefrLevel is not a valid CEFR level", () => {

        const delegate = new GetLevelTestBank({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" })), /cefrLevel/);
    });
});
