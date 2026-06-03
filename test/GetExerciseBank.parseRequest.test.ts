import { assert } from "chai";
import { Request } from "express";
import { GetExerciseBank } from "../src/dlg/exercises/GetExerciseBank";

function makeReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("GetExerciseBank.parseRequest", () => {

    it("parses moduleId from path params", () => {

        const delegate = new GetExerciseBank({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1" }));

        assert.equal(parsed.moduleId, "mod-1");
    });

});

