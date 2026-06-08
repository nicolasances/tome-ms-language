import { assert } from "chai";
import { Request } from "express";
import { PostMePracticedVocabulary } from "../src/dlg/user/PostMePracticedVocabulary";

function makeReq(moduleId: any, body: any): Request {
    return { params: { moduleId }, body } as unknown as Request;
}

describe("PostMePracticedVocabulary.parseRequest", () => {

    it("parses moduleId and vocabularyItemIds", () => {

        const delegate = new PostMePracticedVocabulary({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("mod-1", { vocabularyItemIds: ["v-1", "v-2"] }));

        assert.equal(parsed.moduleId, "mod-1");
        assert.deepEqual(parsed.vocabularyItemIds, ["v-1", "v-2"]);
    });

    it("throws 400 when moduleId is missing", () => {

        const delegate = new PostMePracticedVocabulary({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq(undefined, { vocabularyItemIds: ["v-1"] })), /moduleId/i);
    });

    it("throws 400 when vocabularyItemIds is missing", () => {

        const delegate = new PostMePracticedVocabulary({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq("mod-1", {})), /vocabularyItemIds/i);
    });

    it("throws 400 when vocabularyItemIds is not an array", () => {

        const delegate = new PostMePracticedVocabulary({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { vocabularyItemIds: "v-1" })), /vocabularyItemIds/i);
    });

    it("throws 400 when vocabularyItemIds is an empty array", () => {

        const delegate = new PostMePracticedVocabulary({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq("mod-1", { vocabularyItemIds: [] })), /vocabularyItemIds/i);
    });
});
