import { assert } from "chai";
import { Request } from "express";
import { PostLevelTestBankExercises } from "../../../src/dlg/levelTestBanks/PostLevelTestBankExercises";

function makeValidExercise(overrides: Record<string, any> = {}) {
    return { type: "translation_active", prompt: "I eat", answer: "jeg spiser", vocabularyItemId: "vocab-1", ...overrides };
}

function makeReq(params: any, body: any): Request {
    return { params, body } as unknown as Request;
}

describe("PostLevelTestBankExercises.parseRequest", () => {

    it("parses cefrLevel from params and exercises from body", () => {

        const delegate = new PostLevelTestBankExercises({} as any, {} as any);

        const parsed = delegate.parseRequest(makeReq({ cefrLevel: "B1" }, { exercises: [makeValidExercise()] }));

        assert.equal(parsed.cefrLevel, "B1");
        assert.equal(parsed.exercises.length, 1);
    });

    it("throws 400 when cefrLevel is not a valid CEFR level", () => {

        const delegate = new PostLevelTestBankExercises({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "Z9" }, { exercises: [makeValidExercise()] })), /cefrLevel/);
    });

    it("throws 400 when exercises is not a non-empty array", () => {

        const delegate = new PostLevelTestBankExercises({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ cefrLevel: "B1" }, { exercises: [] })), /non-empty array/);
    });
});
