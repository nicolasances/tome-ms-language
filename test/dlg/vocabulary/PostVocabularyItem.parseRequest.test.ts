import { assert } from "chai";
import { Request } from "express";
import { PostVocabularyItem } from "../../../src/dlg/vocabulary/PostVocabularyItem";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validBody = {
    id: "A1-01-v-jeg-5325",
    danish: "jeg",
    english: "I",
    type: "pronoun",
    cefrLevel: "A1",
    source: "curriculum",
};

describe("PostVocabularyItem.parseRequest", () => {

    it("parses a valid curriculum item with all required fields", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(validBody));
        assert.equal(parsed.id, "A1-01-v-jeg-5325");
        assert.equal(parsed.danish, "jeg");
        assert.equal(parsed.english, "I");
        assert.equal(parsed.type, "pronoun");
        assert.equal(parsed.cefrLevel, "A1");
        assert.equal(parsed.source, "curriculum");
        assert.isNull(parsed.context);
        assert.deepEqual(parsed.tags, []);
        assert.isNull(parsed.addedByUserId);
    });

    it("parses optional context when provided", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ...validBody, context: "physical size" }));
        assert.equal(parsed.context, "physical size");
    });

    it("parses optional tags when provided", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ...validBody, tags: ["home"] }));
        assert.deepEqual(parsed.tags, ["home"]);
    });

    it("throws 400 when id is missing", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const { id: _id, ...body } = validBody;
        assert.throws(() => delegate.parseRequest(makeReq(body)), /id/i);
    });

    it("throws 400 when danish is missing", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const { danish: _d, ...body } = validBody;
        assert.throws(() => delegate.parseRequest(makeReq(body)), /danish/i);
    });

    it("throws 400 when english is missing", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const { english: _e, ...body } = validBody;
        assert.throws(() => delegate.parseRequest(makeReq(body)), /english/i);
    });

    it("throws 400 when type is invalid", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, type: "galaxy-brain" })), /type/i);
    });

    it("throws 400 when cefrLevel is invalid", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, cefrLevel: "Z9" })), /cefrLevel/i);
    });

    it("throws 400 when source is invalid", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, source: "alien" })), /source/i);
    });

    it("throws 400 when source is user_added and addedByUserId is absent", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, source: "user_added" })), /addedByUserId/i);
    });

    it("parses user_added item correctly when addedByUserId is provided", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ...validBody, source: "user_added", addedByUserId: "user-42" }));
        assert.equal(parsed.source, "user_added");
        assert.equal(parsed.addedByUserId, "user-42");
    });

    it("throws 400 when source is curriculum and addedByUserId is provided", () => {
        const delegate = new PostVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, addedByUserId: "user-1" })), /addedByUserId/i);
    });

});

