import { assert } from "chai";
import { Request } from "express";
import { GetVocabularyItems } from "../src/dlg/vocabulary/GetVocabularyItems";

function makeReq(query: Record<string, string> = {}): Request {
    return { params: {}, body: {}, query } as unknown as Request;
}

describe("GetVocabularyItems.parseRequest", () => {

    it("returns undefined cefrLevel when no query param is given", () => {
        const delegate = new GetVocabularyItems({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq());
        assert.isUndefined(parsed.cefrLevel);
    });

    it("parses a valid cefrLevel query param", () => {
        const delegate = new GetVocabularyItems({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "B1" }));
        assert.equal(parsed.cefrLevel, "B1");
    });

    it("throws 400 for an invalid cefrLevel", () => {
        const delegate = new GetVocabularyItems({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" })), /cefrLevel/i);
    });

});

