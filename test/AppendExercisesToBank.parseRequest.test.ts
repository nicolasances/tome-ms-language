import { assert } from "chai";
import { Request } from "express";
import { AppendExercisesToBank } from "../src/dlg/AppendExercisesToBank";

function makeReq(params: Record<string, string>, body: Record<string, any>): Request {
    return { params, body } as unknown as Request;
}

const validTranslationActive = {
    type: "translation_active",
    prompt: "Write 'hello' in Danish",
    answer: "hej",
    vocabularyItemId: "vocab-1",
};

const validSentenceReorder = {
    type: "sentence_reorder",
    prompt: "Reorder the words",
    promptTranslation: "Reorder the words",
    answer: "Jeg er glad",
    words: ["jeg", "er", "glad"],
    grammarConceptId: "grammar-1",
};

describe("AppendExercisesToBank.parseRequest", () => {

    it("parses moduleId from path params and exercises from body", () => {

        const delegate = new AppendExercisesToBank({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { exercises: [validTranslationActive] }));

        assert.equal(parsed.moduleId, "mod-1");
        assert.equal(parsed.exercises.length, 1);
        assert.equal(parsed.exercises[0].type, "translation_active");
    });

    it("throws 400 when exercises is missing", () => {

        const delegate = new AppendExercisesToBank({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, {})), /exercises/i);
    });

    it("throws 400 when exercises is an empty array", () => {

        const delegate = new AppendExercisesToBank({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { exercises: [] })), /exercises/i);
    });

    it("throws 400 when an exercise has an invalid type", () => {

        const delegate = new AppendExercisesToBank({} as any, {} as any);
        assert.throws(
            () => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { exercises: [{ ...validTranslationActive, type: "bad_type" }] })),
            /type/i
        );
    });

    it("throws 400 when sentence_reorder is missing words", () => {

        const delegate = new AppendExercisesToBank({} as any, {} as any);
        const { words: _w, ...noWords } = validSentenceReorder;
        assert.throws(
            () => delegate.parseRequest(makeReq({ moduleId: "mod-1" }, { exercises: [noWords] })),
            /words/i
        );
    });

});
