import { assert } from "chai";
import { Request } from "express";
import { PutMeModuleProgress } from "../src/dlg/PutMeModuleProgress";

function makeReq(params: any, body: any): Request {
    return { params, query: {}, body } as unknown as Request;
}

describe("PutMeModuleProgress.parseRequest", () => {

    it("parses moduleId and status from the request", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { status: "in_progress" }));

        assert.equal(parsed.moduleId, "mod-1");
        assert.equal(parsed.status, "in_progress");
    });

    it("accepts completed as a valid status", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { status: "completed" }));

        assert.equal(parsed.status, "completed");
    });

    it("throws 400 when status is missing", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, {})), /400|status/i);
    });

    it("throws 400 when status is locked", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { status: "locked" })), /400|status/i);
    });

    it("throws 400 when status is available", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { status: "available" })), /400|status/i);
    });

    it("throws 400 when moduleId param is missing", () => {
        const delegate = new PutMeModuleProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({}, { status: "in_progress" })), /400|moduleId/i);
    });
});
