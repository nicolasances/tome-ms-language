import { assert } from "chai";
import { Request } from "express";
import { GetMe } from "../src/dlg/user/GetMe";

function makeReq(body?: any): Request {
    return { params: {}, body } as unknown as Request;
}

describe("GetMe.parseRequest", () => {

    it("returns an empty object regardless of request contents", () => {

        const delegate = new GetMe({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(undefined));

        assert.deepEqual(parsed, {});
    });

});

