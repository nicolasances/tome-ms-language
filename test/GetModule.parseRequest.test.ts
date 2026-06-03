import { assert } from "chai";
import { Request } from "express";
import { GetModule } from "../src/dlg/modules/GetModule";

function makeReq(params: Record<string, any>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetModule.parseRequest", () => {

    it("parses id from route params", () => {

        const delegate = new GetModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "danish-A1-01" }));

        assert.equal(parsed.id, "danish-A1-01");
    });

    it("throws 400 when id param is missing", () => {

        const delegate = new GetModule({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({})), /id/i);
    });

});

