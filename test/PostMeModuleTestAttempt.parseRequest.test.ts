import { assert } from "chai";
import { Request } from "express";
import { PostMeModuleTestAttempt } from "../src/dlg/user/PostMeModuleTestAttempt";

function makeReq(moduleId: string, body: any): Request {
    return { params: { moduleId }, query: {}, body } as unknown as Request;
}

describe("PostMeModuleTestAttempt.parseRequest", () => {

    it("parses moduleId, score, and passed from the request", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("mod-1", { score: 80, passed: true }));

        assert.equal(parsed.moduleId, "mod-1");
        assert.equal(parsed.score, 80);
        assert.equal(parsed.passed, true);
    });

    it("accepts a failed attempt with score 0", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("mod-1", { score: 0, passed: false }));

        assert.equal(parsed.score, 0);
        assert.equal(parsed.passed, false);
    });

    it("throws 400 when moduleId is missing", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, query: {}, body: { score: 80, passed: true } } as unknown as Request), /400|moduleId/i);
    });

    it("throws 400 when score is missing", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { passed: true })), /400|score/i);
    });

    it("throws 400 when score is below 0", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { score: -1, passed: true })), /400|score/i);
    });

    it("throws 400 when score is above 100", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { score: 101, passed: true })), /400|score/i);
    });

    it("throws 400 when passed is missing", () => {
        const delegate = new PostMeModuleTestAttempt({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { score: 80 })), /400|passed/i);
    });
});

