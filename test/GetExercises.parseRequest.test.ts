import { assert } from "chai";
import { Request } from "express";
import { GetExercises } from "../src/dlg/exercises/GetExercises";

function makeReq(query: Record<string, string>): Request {
    return { params: {}, query, body: {} } as unknown as Request;
}

describe("GetExercises.parseRequest", () => {

    it("parses moduleId from query params", () => {

        const delegate = new GetExercises({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1" }));

        assert.equal(parsed.moduleId, "mod-1");
    });

    it("throws 400 when moduleId query param is missing", () => {

        const delegate = new GetExercises({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({})), /moduleId/i);
    });

});

