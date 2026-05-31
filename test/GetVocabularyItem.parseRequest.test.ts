import { assert } from "chai";
import { Request } from "express";
import { GetVocabularyItem } from "../src/dlg/GetVocabularyItem";

function makeReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetVocabularyItem.parseRequest", () => {

    it("parses id from route params", () => {
        const delegate = new GetVocabularyItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "A1-01-v-jeg-5325" }));
        assert.equal(parsed.id, "A1-01-v-jeg-5325");
    });

    it("throws 400 when id param is missing", () => {
        const delegate = new GetVocabularyItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({})), /id/i);
    });

});
