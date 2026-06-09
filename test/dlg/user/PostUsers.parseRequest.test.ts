import { assert } from "chai";
import { Request } from "express";
import { PostUsers } from "../../../src/dlg/user/PostUsers";

function makeReq(body?: any): Request {
    return { params: {}, body } as unknown as Request;
}

describe("PostUsers.parseRequest", () => {

    it("returns an empty object when no body is provided", () => {

        const delegate = new PostUsers({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(undefined));

        assert.deepEqual(parsed, {});
    });

    it("returns an empty object even when a body is provided", () => {

        const delegate = new PostUsers({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ unexpected: "field" }));

        assert.deepEqual(parsed, {});
    });

});

