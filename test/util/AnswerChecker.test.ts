import { assert } from "chai";
import { normalize, checkAnswer, levenshtein, fuzzyThreshold } from "../../src/util/AnswerChecker";
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

    it("returns fuzzyMatched=false on an exact match", () => {

        const exercise = makeExercise({ answer: "hej" });
        const result = checkAnswer("hej", exercise);

        assert.isTrue(result.isCorrect);
        assert.isFalse(result.fuzzyMatched);
    });
});

describe("levenshtein", () => {

    it("returns 0 for identical strings", () => {
        assert.equal(levenshtein("abc", "abc"), 0);
    });

    it("returns 1 for a single substitution", () => {
        assert.equal(levenshtein("hej", "hey"), 1);
    });

    it("returns 1 for a single substitution in a longer word", () => {
        assert.equal(levenshtein("spiser", "sposer"), 1);
    });

    it("returns the length of b when a is empty", () => {
        assert.equal(levenshtein("", "hej"), 3);
    });

    it("returns the length of a when b is empty", () => {
        assert.equal(levenshtein("hej", ""), 3);
    });
});

describe("fuzzyThreshold", () => {

    it("returns 1 for a 10-char answer (upper boundary of first band)", () => {
        assert.equal(fuzzyThreshold("1234567890"), 1);
    });

    it("returns 2 for an 11-char answer (start of second band)", () => {
        assert.equal(fuzzyThreshold("12345678901"), 2);
    });

    it("returns 2 for a 20-char answer (upper boundary of second band)", () => {
        assert.equal(fuzzyThreshold("12345678901234567890"), 2);
    });

    it("returns 3 for a 21-char answer (start of third band)", () => {
        assert.equal(fuzzyThreshold("123456789012345678901"), 3);
    });
});

describe("checkAnswer — fuzzy matching", () => {

    it("accepts a one-edit typo on translation_active and sets fuzzyMatched=true", () => {

        const exercise = makeExercise({ type: "translation_active", answer: "hej" });
        const result = checkAnswer("hejj", exercise);

        assert.isTrue(result.isCorrect);
        assert.isTrue(result.fuzzyMatched);
        assert.equal(result.correctAnswer, "hej");
    });

    it("rejects an answer with too many edits on translation_active", () => {

        // "xyz" vs "hej": all 3 chars differ → distance 3, threshold for length-3 answer = 1
        const exercise = makeExercise({ type: "translation_active", answer: "hej" });
        const result = checkAnswer("xyz", exercise);

        assert.isFalse(result.isCorrect);
    });

    it("accepts a one-edit typo on error_correction and sets fuzzyMatched=true", () => {

        const exercise = makeExercise({ type: "error_correction", answer: "hej", vocabularyItemId: null, grammarConceptId: "gc-1" });
        const result = checkAnswer("hejj", exercise);

        assert.isTrue(result.isCorrect);
        assert.isTrue(result.fuzzyMatched);
    });

    it("does NOT apply fuzzy matching on fill_blank — one-edit typo is rejected", () => {

        const exercise = makeExercise({ type: "fill_blank", answer: "hej" });
        const result = checkAnswer("hejj", exercise);

        assert.isFalse(result.isCorrect);
        assert.isFalse(result.fuzzyMatched);
    });

    it("does NOT apply fuzzy matching on conjugation_drill — one-edit typo is rejected", () => {

        const exercise = makeExercise({ type: "conjugation_drill", answer: "går" });
        const result = checkAnswer("gar", exercise);

        assert.isFalse(result.isCorrect);
        assert.isFalse(result.fuzzyMatched);
    });

    it("does NOT apply fuzzy matching on multiple_choice — one-edit typo is rejected", () => {

        const exercise = makeExercise({ type: "multiple_choice", answer: "hej", promptTranslation: "hello" });
        const result = checkAnswer("hejj", exercise);

        assert.isFalse(result.isCorrect);
        assert.isFalse(result.fuzzyMatched);
    });

    it("fuzzy-matches against alternativeAnswers too", () => {

        const exercise = makeExercise({ type: "translation_active", answer: "hej", alternativeAnswers: ["goddag"] });
        // "goddak" is 1 edit from "goddag"
        const result = checkAnswer("goddak", exercise);

        assert.isTrue(result.isCorrect);
        assert.isTrue(result.fuzzyMatched);
        assert.equal(result.correctAnswer, "hej");
    });
});
