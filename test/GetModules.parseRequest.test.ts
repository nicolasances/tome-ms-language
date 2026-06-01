import { assert } from "chai";
import { Request } from "express";
import { GetModules } from "../src/dlg/GetModules";

function makeReq(query: Record<string, any>): Request {
    return { params: {}, body: {}, query } as unknown as Request;
}

describe("GetModules.parseRequest", () => {

    it("returns no filters when no query params are given", () => {

        const delegate = new GetModules({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({}));

        assert.isUndefined(parsed.cefrLevel);
        assert.isUndefined(parsed.isUserGenerated);
    });

    it("parses cefrLevel correctly", () => {

        const delegate = new GetModules({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "B1" }));

        assert.equal(parsed.cefrLevel, "B1");
    });

    it("parses isUserGenerated=true as boolean true", () => {

        const delegate = new GetModules({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ isUserGenerated: "true" }));

        assert.strictEqual(parsed.isUserGenerated, true);
    });

    it("parses isUserGenerated=false as boolean false", () => {

        const delegate = new GetModules({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ isUserGenerated: "false" }));

        assert.strictEqual(parsed.isUserGenerated, false);
    });

    it("treats absent isUserGenerated as undefined (no filter)", () => {

        const delegate = new GetModules({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({}));

        assert.isUndefined(parsed.isUserGenerated);
    });

    it("throws 400 when cefrLevel is an invalid value", () => {

        const delegate = new GetModules({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" })), /cefrLevel/i);
    });

});
