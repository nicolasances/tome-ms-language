import { assert } from "chai";
import { Request } from "express";
import { PatchExerciseTimesShown } from "../src/dlg/PatchExerciseTimesShown";

function makeReq(params: Record<string, string>): Request {
    return { params, body: {} } as unknown as Request;
}

describe("PatchExerciseTimesShown.parseRequest", () => {

    it("parses id from path params", () => {

        const delegate = new PatchExerciseTimesShown({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "ex-001" }));

        assert.equal(parsed.id, "ex-001");
    });

});
