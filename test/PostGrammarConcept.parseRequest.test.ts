import { assert } from "chai";
import { Request } from "express";
import { PostGrammarConcept } from "../src/dlg/PostGrammarConcept";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validBody = {
    id: "A1-01-g-present-tense-6604",
    name: "Present Tense",
    category: "tenses",
    cefrLevelIntroduced: "A1",
    explanation: "The present tense describes current actions.",
    examples: [{ danish: "Jeg spiser.", english: "I eat." }],
};

describe("PostGrammarConcept.parseRequest", () => {

    it("parses a valid body with all required fields", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(validBody));

        assert.equal(parsed.id, validBody.id);
        assert.equal(parsed.name, validBody.name);
        assert.equal(parsed.category, validBody.category);
        assert.equal(parsed.cefrLevelIntroduced, validBody.cefrLevelIntroduced);
        assert.equal(parsed.explanation, validBody.explanation);
        assert.deepEqual(parsed.examples, validBody.examples);
    });

    it("parses a valid body with two examples", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const body = { ...validBody, examples: [{ danish: "Jeg spiser.", english: "I eat." }, { danish: "Han løber.", english: "He runs." }] };
        const parsed = delegate.parseRequest(makeReq(body));

        assert.equal(parsed.examples.length, 2);
    });

    it("throws 400 when id is missing", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const { id: _id, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /id/i);
    });

    it("throws 400 when name is missing", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const { name: _n, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /name/i);
    });

    it("throws 400 when category is invalid", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, category: "galaxy-brain" })), /category/i);
    });

    it("throws 400 when cefrLevelIntroduced is invalid", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, cefrLevelIntroduced: "Z9" })), /cefrLevelIntroduced/i);
    });

    it("throws 400 when explanation is missing", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const { explanation: _e, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /explanation/i);
    });

    it("throws 400 when examples is missing", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const { examples: _ex, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /examples/i);
    });

    it("throws 400 when examples is an empty array", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, examples: [] })), /examples/i);
    });

    it("throws 400 when examples has more than 2 items", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);
        const tooMany = [
            { danish: "a", english: "a" },
            { danish: "b", english: "b" },
            { danish: "c", english: "c" },
        ];

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, examples: tooMany })), /examples/i);
    });

    it("throws 400 when an example is missing danish", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, examples: [{ english: "I eat." }] })), /danish/i);
    });

    it("throws 400 when an example is missing english", () => {

        const delegate = new PostGrammarConcept({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, examples: [{ danish: "Jeg spiser." }] })), /english/i);
    });

});
