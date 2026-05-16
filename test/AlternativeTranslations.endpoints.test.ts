import { assert } from "chai";
import { Request } from "express";

// ---------------------------------------------------------------------------
// Helpers — minimal mock Request builders
// ---------------------------------------------------------------------------

function makePostReq(params: Record<string, string>, body: Record<string, any>): Request {
    return { params, body } as unknown as Request;
}

function makeDeleteReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

function makeGetReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

// ---------------------------------------------------------------------------
// AddWordAlternative.parseRequest
// ---------------------------------------------------------------------------

import { AddWordAlternative } from "../src/dlg/AddWordAlternative";

describe("AddWordAlternative.parseRequest", () => {

    it("parses language, wordId, and translation from request", () => {
        const delegate = new AddWordAlternative({} as any, {} as any);
        const req = makePostReq({ language: "danish", wordId: "abc123" }, { translation: "Hej" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.wordId, "abc123");
        assert.equal(parsed.translation, "Hej");
    });

    it("throws 400 when translation is missing", () => {
        const delegate = new AddWordAlternative({} as any, {} as any);
        const req = makePostReq({ language: "danish", wordId: "abc123" }, {});
        assert.throws(() => delegate.parseRequest(req), /translation/i);
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new AddWordAlternative({} as any, {} as any);
        const req = makePostReq({ language: "klingon", wordId: "abc123" }, { translation: "Hej" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});

// ---------------------------------------------------------------------------
// RemoveWordAlternative.parseRequest
// ---------------------------------------------------------------------------

import { RemoveWordAlternative } from "../src/dlg/RemoveWordAlternative";

describe("RemoveWordAlternative.parseRequest", () => {

    it("parses language, wordId, and altId from request", () => {
        const delegate = new RemoveWordAlternative({} as any, {} as any);
        const req = makeDeleteReq({ language: "danish", wordId: "abc123", id: "uuid-1" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.wordId, "abc123");
        assert.equal(parsed.altId, "uuid-1");
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new RemoveWordAlternative({} as any, {} as any);
        const req = makeDeleteReq({ language: "klingon", wordId: "abc123", id: "uuid-1" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});

// ---------------------------------------------------------------------------
// AddSentenceAlternative.parseRequest
// ---------------------------------------------------------------------------

import { AddSentenceAlternative } from "../src/dlg/AddSentenceAlternative";

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

// ---------------------------------------------------------------------------
// RemoveSentenceAlternative.parseRequest
// ---------------------------------------------------------------------------

import { RemoveSentenceAlternative } from "../src/dlg/RemoveSentenceAlternative";

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

// ---------------------------------------------------------------------------
// GetWord.parseRequest
// ---------------------------------------------------------------------------

import { GetWord } from "../src/dlg/GetWord";

describe("GetWord.parseRequest", () => {

    it("parses language and wordId from request", () => {
        const delegate = new GetWord({} as any, {} as any);
        const req = makeGetReq({ language: "danish", wordId: "abc123" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.wordId, "abc123");
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new GetWord({} as any, {} as any);
        const req = makeGetReq({ language: "klingon", wordId: "abc123" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});

// ---------------------------------------------------------------------------
// GetSentence.parseRequest
// ---------------------------------------------------------------------------

import { GetSentence } from "../src/dlg/GetSentence";

describe("GetSentence.parseRequest", () => {

    it("parses language and sentenceId from request", () => {
        const delegate = new GetSentence({} as any, {} as any);
        const req = makeGetReq({ language: "danish", sentenceId: "sent123" });
        const parsed = delegate.parseRequest(req);
        assert.equal(parsed.language, "danish");
        assert.equal(parsed.sentenceId, "sent123");
    });

    it("throws 400 for unsupported language", () => {
        const delegate = new GetSentence({} as any, {} as any);
        const req = makeGetReq({ language: "klingon", sentenceId: "sent123" });
        assert.throws(() => delegate.parseRequest(req), /unsupported language/i);
    });
});
