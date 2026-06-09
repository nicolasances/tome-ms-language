import { assert } from "chai";
import { normalize, checkAnswer } from "../../src/util/AnswerChecker";
import { Exercise } from "../../src/model/Exercise";

function makeExercise(overrides: Partial<ConstructorParameters<typeof Exercise>[0]> = {}): Exercise {
    return new Exercise({
        id: "ex-1",
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "Translate 'hello'",
        answer: "hej",
        alternativeAnswers: [],
        userContributedAnswers: [],
        vocabularyItemId: "vocab-1",
        ...overrides,
    });
}

describe("normalize", () => {

    it("lowercases the input", () => {
        assert.equal(normalize("HEJ"), "hej");
    });

    it("strips leading and trailing whitespace", () => {
        assert.equal(normalize("  hej  "), "hej");
    });

    it("strips punctuation", () => {
        assert.equal(normalize("hej!"), "hej");
        assert.equal(normalize("hej."), "hej");
        assert.equal(normalize("hej,"), "hej");
        assert.equal(normalize("hej?"), "hej");
    });

    it("handles multiple punctuation characters", () => {
        assert.equal(normalize("Tak, mange tak!"), "tak mange tak");
    });

    it("returns empty string for empty input", () => {
        assert.equal(normalize(""), "");
    });
});

describe("checkAnswer", () => {

    it("returns correct when userAnswer matches the canonical answer (case-insensitive)", () => {

        const exercise = makeExercise({ answer: "hej" });
        const result = checkAnswer("HEJ", exercise);

        assert.isTrue(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
    });

    it("returns correct when userAnswer matches an alternativeAnswer", () => {

        const exercise = makeExercise({ answer: "hej", alternativeAnswers: ["goddag"] });
        const result = checkAnswer("Goddag", exercise);

        assert.isTrue(result.isCorrect);
    });

    it("returns correct when userAnswer matches a userContributedAnswer", () => {

        const exercise = makeExercise({ answer: "hej", userContributedAnswers: ["hey"] });
        const result = checkAnswer("Hey", exercise);

        assert.isTrue(result.isCorrect);
    });

    it("returns incorrect when userAnswer does not match any accepted answer", () => {

        const exercise = makeExercise({ answer: "hej", alternativeAnswers: ["goddag"] });
        const result = checkAnswer("farvel", exercise);

        assert.isFalse(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
    });

    it("strips punctuation before comparing", () => {

        const exercise = makeExercise({ answer: "hej" });
        const result = checkAnswer("hej!", exercise);

        assert.isTrue(result.isCorrect);
    });

    it("returns incorrect for empty userAnswer", () => {

        const exercise = makeExercise({ answer: "hej" });
        const result = checkAnswer("", exercise);

        assert.isFalse(result.isCorrect);
    });

    it("returns the canonical answer as correctAnswer regardless of which variant matched", () => {

        const exercise = makeExercise({ answer: "hej", alternativeAnswers: ["goddag"] });
        const result = checkAnswer("goddag", exercise);

        assert.isTrue(result.isCorrect);
        assert.equal(result.correctAnswer, "hej");
    });
});
