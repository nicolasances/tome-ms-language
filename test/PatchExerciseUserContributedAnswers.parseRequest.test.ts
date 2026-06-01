import { assert } from "chai";
import { Request } from "express";
import { PatchExerciseUserContributedAnswers } from "../src/dlg/PatchExerciseUserContributedAnswers";

function makeReq(params: Record<string, string>, body: Record<string, any>): Request {
    return { params, body } as unknown as Request;
}

describe("PatchExerciseUserContributedAnswers.parseRequest", () => {

    it("parses id and answer from request", () => {

        const delegate = new PatchExerciseUserContributedAnswers({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ id: "ex-001" }, { answer: "hejsa" }));

        assert.equal(parsed.id, "ex-001");
        assert.equal(parsed.answer, "hejsa");
    });

    it("throws 400 when answer is missing from body", () => {

        const delegate = new PatchExerciseUserContributedAnswers({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ id: "ex-001" }, {})), /answer/i);
    });

});
