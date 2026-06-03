import { assert } from "chai";
import { Request } from "express";
import { PostGrammarConceptBatch } from "../src/dlg/grammar/PostGrammarConceptBatch";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validItem = {
    id: "A1-01-g-present-tense-6604",
    name: "Present Tense",
    category: "tenses",
    cefrLevelIntroduced: "A1",
    explanation: "The present tense describes current actions.",
    examples: [{ danish: "Jeg spiser.", english: "I eat." }],
};

describe("PostGrammarConceptBatch.parseRequest", () => {

    it("parses a valid batch of items", () => {

        const delegate = new PostGrammarConceptBatch({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ items: [validItem] }));

        assert.equal(parsed.items.length, 1);
        assert.equal(parsed.items[0].id, validItem.id);
        assert.equal(parsed.validationErrors.length, 0);
    });

    it("throws 400 when items is missing", () => {

        const delegate = new PostGrammarConceptBatch({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /items/i);
    });

    it("throws 400 when items is an empty array", () => {

        const delegate = new PostGrammarConceptBatch({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ items: [] })), /items/i);
    });

    it("collects per-item validation errors without throwing", () => {

        const delegate = new PostGrammarConceptBatch({} as any, {} as any);
        const badItem = { id: "bad-1" };

        const parsed = delegate.parseRequest(makeReq({ items: [validItem, badItem] }));

        assert.equal(parsed.items.length, 1);
        assert.equal(parsed.validationErrors.length, 1);
        assert.equal(parsed.validationErrors[0].id, "bad-1");
    });

});

