import { assert } from "chai";
import { Request } from "express";
import { PutMeCefrLevel } from "../../../src/dlg/user/PutMeCefrLevel";

function makeReq(body?: any): Request {
    return { params: {}, body } as unknown as Request;
}

describe("PutMeCefrLevel.parseRequest", () => {

    it("returns the parsed cefrLevel when a valid level is provided", () => {

        const delegate = new PutMeCefrLevel({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "A2" }));

        assert.equal(parsed.cefrLevel, "A2");
    });

    it("throws 400 when cefrLevel is missing from the body", () => {

        const delegate = new PutMeCefrLevel({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /cefrLevel/i);
    });

    it("throws 400 when cefrLevel is not a valid CEFR value", () => {

        const delegate = new PutMeCefrLevel({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" })), /cefrLevel/i);
    });

});

