import { assert } from "chai";
import { Request } from "express";
import { StartRestore } from "../../../src/dlg/backup/StartRestore";

function makeReq(body?: any): Request {
    return { params: {}, body } as unknown as Request;
}

describe("StartRestore.parseRequest", () => {

    it("extracts the date from the request body", () => {

        const delegate = new StartRestore({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ date: "20260821" }));

        assert.deepEqual(parsed, { date: "20260821" });
    });

    it("throws a 400 ValidationError when no date is provided", () => {

        const delegate = new StartRestore({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq(undefined)), /date/i);
    });

    it("throws a 400 ValidationError when date is an empty string", () => {

        const delegate = new StartRestore({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ date: "" })), /date/i);
    });
});
