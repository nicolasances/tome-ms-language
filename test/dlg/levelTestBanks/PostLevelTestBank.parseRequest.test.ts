import { assert } from "chai";
import { Request } from "express";
import { PostLevelTestBank } from "../../../src/dlg/levelTestBanks/PostLevelTestBank";

function makeValidExercise(overrides: Record<string, any> = {}) {
    return { type: "translation_active", prompt: "I eat", answer: "jeg spiser", vocabularyItemId: "vocab-1", ...overrides };
}

function makeReq(body: any): Request {
    return { params: {}, body } as unknown as Request;
}

describe("PostLevelTestBank.parseRequest", () => {

    it("parses cefrLevel and exercises from the body", () => {

        const delegate = new PostLevelTestBank({} as any, {} as any);

        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "A1", exercises: [makeValidExercise()] }));

        assert.equal(parsed.cefrLevel, "A1");
        assert.equal(parsed.exercises.length, 1);
        assert.equal(parsed.exercises[0].vocabularyItemId, "vocab-1");
    });

    it("throws 400 when cefrLevel is missing", () => {

        const delegate = new PostLevelTestBank({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ exercises: [makeValidExercise()] })), /cefrLevel/);
    });

    it("throws 400 when cefrLevel is not a valid CEFR level", () => {

        const delegate = new PostLevelTestBank({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9", exercises: [makeValidExercise()] })), /cefrLevel/);
    });

    it("throws 400 when exercises is not a non-empty array", () => {

        const delegate = new PostLevelTestBank({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "A1", exercises: [] })), /non-empty array/);
    });

    it("propagates per-exercise validation errors", () => {

        const delegate = new PostLevelTestBank({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "A1", exercises: [{ type: "bad_type", prompt: "x", answer: "y" }] })));
    });
});
