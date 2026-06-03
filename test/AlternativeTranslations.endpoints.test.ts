import { assert } from "chai";
import { Request } from "express";

function makePostReq(params: Record<string, string>, body: Record<string, any>): Request {
    return { params, body } as unknown as Request;
}

function makeDeleteReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

import { AddSentenceAlternative } from "../src/dlg/sentences/AddSentenceAlternative";

describe("AddSentenceAlternative.parseRequest", () => {

    it("parses language, sentenceId, and translation from request", () => {
        const delegate = new AddSentenceAlternative({} as any, {} as any);
        const req = makePostReq({ language: "danish", sentenceId: "sent123" }, { translation: "Hej verden" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.sentenceId, "sent123");
        assert.equal(parsed.translation, "Hej verden");
    });

    it("throws 400 when translation is missing", () => {
        const delegate = new AddSentenceAlternative({} as any, {} as any);
        const req = makePostReq({ language: "danish", sentenceId: "sent123" }, {});
        assert.throws(() => delegate.parseRequest(req), /translation/i);
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new AddSentenceAlternative({} as any, {} as any);
        const req = makePostReq({ language: "klingon", sentenceId: "sent123" }, { translation: "Hej verden" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});

import { RemoveSentenceAlternative } from "../src/dlg/sentences/RemoveSentenceAlternative";

describe("RemoveSentenceAlternative.parseRequest", () => {

    it("parses language, sentenceId, and altId from request", () => {
        const delegate = new RemoveSentenceAlternative({} as any, {} as any);
        const req = makeDeleteReq({ language: "danish", sentenceId: "sent123", id: "uuid-2" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.sentenceId, "sent123");
        assert.equal(parsed.altId, "uuid-2");
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new RemoveSentenceAlternative({} as any, {} as any);
        const req = makeDeleteReq({ language: "klingon", sentenceId: "sent123", id: "uuid-2" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});

