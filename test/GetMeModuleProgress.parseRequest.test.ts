import { assert } from "chai";
import { Request } from "express";
import { GetMeModuleProgress } from "../src/dlg/GetMeModuleProgress";

function makeReq(overrides: { query?: any } = {}): Request {
    return { params: {}, query: {}, body: {}, ...overrides } as unknown as Request;
}

describe("GetMeModuleProgress.parseRequest", () => {

    it("returns no cefrLevel filter when no query param is given", () => {
        const delegate = new GetMeModuleProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq());

        assert.isUndefined(parsed.cefrLevel);
    });

    it("parses a valid cefrLevel query param", () => {
        const delegate = new GetMeModuleProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ query: { cefrLevel: "A1" } }));

        assert.equal(parsed.cefrLevel, "A1");
    });
});
