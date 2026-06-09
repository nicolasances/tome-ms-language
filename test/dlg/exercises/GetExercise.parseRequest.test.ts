import { assert } from "chai";
import { Request } from "express";
import { GetExercise } from "../../../src/dlg/exercises/GetExercise";

function makeReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetExercise.parseRequest", () => {

    it("parses id from path params", () => {

        const delegate = new GetExercise({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "ex-001" }));

        assert.equal(parsed.id, "ex-001");
    });

});

