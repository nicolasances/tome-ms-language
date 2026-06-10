import { assert } from "chai";
import { PostExerciseAnswerVerification } from "../../../src/dlg/exercises/PostExerciseAnswerVerification";

function makeReq(params: any = {}, body: any = {}): any {
    return { params, body };
}

describe("PostExerciseAnswerVerification.parseRequest", () => {

    it("throws 400 when exerciseId is missing", () => {

        const delegate = new PostExerciseAnswerVerification({} as any, {} as any);

        try {
            delegate.parseRequest(makeReq({}, { userAnswer: "hej", sessionId: "sess-1", cefrLevel: "A1" }));
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when userAnswer is missing", () => {

        const delegate = new PostExerciseAnswerVerification({} as any, {} as any);

        try {
            delegate.parseRequest(makeReq({ exerciseId: "ex-1" }, { sessionId: "sess-1", cefrLevel: "A1" }));
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when sessionId is missing", () => {

        const delegate = new PostExerciseAnswerVerification({} as any, {} as any);

        try {
            delegate.parseRequest(makeReq({ exerciseId: "ex-1" }, { userAnswer: "hej", cefrLevel: "A1" }));
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when cefrLevel is missing", () => {

        const delegate = new PostExerciseAnswerVerification({} as any, {} as any);

        try {
            delegate.parseRequest(makeReq({ exerciseId: "ex-1" }, { userAnswer: "hej", sessionId: "sess-1" }));
            assert.fail("Expected 400");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("returns parsed request when all fields are present", () => {

        const delegate = new PostExerciseAnswerVerification({} as any, {} as any);

        const result = delegate.parseRequest(
            makeReq({ exerciseId: "ex-1" }, { userAnswer: "hej", sessionId: "sess-1", cefrLevel: "A2" })
        );

        assert.equal(result.exerciseId, "ex-1");
        assert.equal(result.userAnswer, "hej");
        assert.equal(result.sessionId, "sess-1");
        assert.equal(result.cefrLevel, "A2");
    });
});
