import { assert } from "chai";
import { Request } from "express";
import { PostExerciseBank } from "../src/dlg/PostExerciseBank";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validTranslationActive = {
    type: "translation_active",
    prompt: "Write 'hello' in Danish",
    answer: "hej",
    vocabularyItemId: "vocab-1",
};

const validMultipleChoice = {
    type: "multiple_choice",
    prompt: "Han ___ kaffe",
    promptTranslation: "He ___ coffee",
    answer: "drikker",
    distractors: ["spiser", "sover", "læser"],
    vocabularyItemId: "vocab-2",
};

const validSentenceReorder = {
    type: "sentence_reorder",
    prompt: "I am happy",
    answer: "Jeg er glad",
    words: ["jeg", "er", "glad"],
    grammarConceptId: "grammar-1",
};

const validFillBlank = {
    type: "fill_blank",
    prompt: "Jeg ___ en hund",
    promptTranslation: "I ___ a dog",
    answer: "har",
    vocabularyItemId: "vocab-3",
};

const validErrorCorrection = {
    type: "error_correction",
    prompt: "Han spiser ikke",
    promptTranslation: "He does not eat",
    answer: "Han spiser ikke",
    grammarConceptId: "grammar-2",
};

const validConjugationDrill = {
    type: "conjugation_drill",
    prompt: "Conjugate 'spise' present tense",
    answer: "spiser",
    vocabularyItemId: "vocab-4",
};

const validBody = {
    moduleId: "mod-1",
    exercises: [validTranslationActive],
};

describe("PostExerciseBank.parseRequest", () => {

    it("parses a valid body with a translation_active exercise", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(validBody));

        assert.equal(parsed.moduleId, "mod-1");
        assert.equal(parsed.exercises.length, 1);
        assert.equal(parsed.exercises[0].type, "translation_active");
        assert.equal(parsed.exercises[0].answer, "hej");
    });

    it("parses a valid body with all exercise types", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const exercises = [validTranslationActive, validMultipleChoice, validSentenceReorder, validFillBlank, validErrorCorrection, validConjugationDrill];
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises }));

        assert.equal(parsed.exercises.length, 6);
    });

    it("throws 400 when moduleId is missing", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ exercises: [validTranslationActive] })), /moduleId/i);
    });

    it("throws 400 when exercises is missing", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1" })), /exercises/i);
    });

    it("throws 400 when exercises is an empty array", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [] })), /exercises/i);
    });

    it("throws 400 when an exercise has an invalid type", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const exercises = [{ ...validTranslationActive, type: "unknown_type" }];
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises })), /type/i);
    });

    it("throws 400 when an exercise is missing prompt", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { prompt: _p, ...noPrompt } = validTranslationActive;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noPrompt] })), /prompt/i);
    });

    it("throws 400 when an exercise is missing answer", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { answer: _a, ...noAnswer } = validTranslationActive;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noAnswer] })), /answer/i);
    });

    it("throws 400 when both vocabularyItemId and grammarConceptId are set", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const exercises = [{ ...validTranslationActive, grammarConceptId: "grammar-1" }];
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises })), /vocabularyItemId|grammarConceptId/i);
    });

    it("throws 400 when neither vocabularyItemId nor grammarConceptId is set", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { vocabularyItemId: _v, ...noLink } = validTranslationActive;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noLink] })), /vocabularyItemId|grammarConceptId/i);
    });

    it("throws 400 when a vocabulary type uses grammarConceptId instead of vocabularyItemId", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const exercises = [{ type: "translation_active", prompt: "...", answer: "...", grammarConceptId: "grammar-1" }];
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises })), /vocabularyItemId/i);
    });

    it("throws 400 when a grammar type uses vocabularyItemId instead of grammarConceptId", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const exercises = [{ ...validSentenceReorder, grammarConceptId: undefined, vocabularyItemId: "vocab-1" }];
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises })), /grammarConceptId/i);
    });

    it("throws 400 when sentence_reorder is missing words", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { words: _w, ...noWords } = validSentenceReorder;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noWords] })), /words/i);
    });

    it("throws 400 when multiple_choice is missing distractors", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { distractors: _d, ...noDistractors } = validMultipleChoice;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noDistractors] })), /distractors/i);
    });

    it("throws 400 when fill_blank is missing promptTranslation", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { promptTranslation: _pt, ...noPromptTranslation } = validFillBlank;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noPromptTranslation] })), /promptTranslation/i);
    });

    it("throws 400 when multiple_choice is missing promptTranslation", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { promptTranslation: _pt, ...noPromptTranslation } = validMultipleChoice;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noPromptTranslation] })), /promptTranslation/i);
    });

    it("accepts sentence_reorder without promptTranslation", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [validSentenceReorder] }));

        assert.isNull(parsed.exercises[0].promptTranslation);
    });

    it("throws 400 when error_correction is missing promptTranslation", () => {

        const delegate = new PostExerciseBank({} as any, {} as any);
        const { promptTranslation: _pt, ...noPromptTranslation } = validErrorCorrection;
        assert.throws(() => delegate.parseRequest(makeReq({ moduleId: "mod-1", exercises: [noPromptTranslation] })), /promptTranslation/i);
    });

});
