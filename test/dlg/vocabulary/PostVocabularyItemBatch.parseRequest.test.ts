import { assert } from "chai";
import { Request } from "express";
import { PostVocabularyItemBatch } from "../../../src/dlg/vocabulary/PostVocabularyItemBatch";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validItem = {
    id: "A1-01-n-hus",
    danish: "hus",
    english: "house",
    type: "noun",
    cefrLevel: "A1",
    source: "curriculum",
};

describe("PostVocabularyItemBatch.parseRequest", () => {

    it("parses a valid array of items", () => {
        const delegate = new PostVocabularyItemBatch({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ items: [validItem] }));
        assert.equal(parsed.items.length, 1);
        assert.equal(parsed.items[0].id, "A1-01-n-hus");
    });

    it("throws 400 when items is missing", () => {
        const delegate = new PostVocabularyItemBatch({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({})), /items/i);
    });

    it("throws 400 when items is not an array", () => {
        const delegate = new PostVocabularyItemBatch({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ items: "not-an-array" })), /items/i);
    });

    it("throws 400 when items is an empty array", () => {
        const delegate = new PostVocabularyItemBatch({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ items: [] })), /items/i);
    });

    it("captures validation errors per item without rejecting the whole batch", () => {
        const delegate = new PostVocabularyItemBatch({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({
            items: [
                validItem,
                { id: "BAD", danish: "x", english: "y", type: "INVALID_TYPE", cefrLevel: "A1", source: "curriculum" },
            ],
        }));
        assert.equal(parsed.items.length, 1, "only valid items are in parsed.items");
        assert.equal(parsed.validationErrors.length, 1, "one item captured as validation error");
        assert.equal(parsed.validationErrors[0].id, "BAD");
    });

});

