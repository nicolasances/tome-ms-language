import { assert } from "chai";
import { applyCorrect, applyIncorrect, isMastered, MASTERY_THRESHOLD } from "../../src/util/SrsAlgorithm";

describe("applyCorrect", () => {

    it("increases the score", () => {
        const result = applyCorrect(0.5);
        assert.isAbove(result, 0.5);
    });

    it("applies diminishing increments as the score approaches 1.0", () => {
        const lowIncrease = applyCorrect(0.2) - 0.2;
        const highIncrease = applyCorrect(0.8) - 0.8;
        assert.isBelow(highIncrease, lowIncrease);
    });

    it("never exceeds 1.0 even when starting close to the ceiling", () => {
        const result = applyCorrect(0.99);
        assert.isAtMost(result, 1.0);
    });

    it("returns 1.0 when starting exactly at 1.0", () => {
        assert.equal(applyCorrect(1.0), 1.0);
    });

    it("respects a custom increment factor", () => {
        const defaultResult = applyCorrect(0.5);
        const customResult = applyCorrect(0.5, 0.5);
        assert.isAbove(customResult, defaultResult);
        assert.equal(customResult, 0.75);
    });
});

describe("applyIncorrect", () => {

    it("decreases the score", () => {
        const result = applyIncorrect(0.5);
        assert.isBelow(result, 0.5);
    });

    it("decreases the score proportionally to its current value", () => {
        const highDecrease = applyIncorrect(0.8) - 0.8;
        const lowDecrease = applyIncorrect(0.2) - 0.2;
        assert.isBelow(highDecrease, lowDecrease);
    });

    it("never goes below 0.0 even when starting close to the floor", () => {
        const result = applyIncorrect(0.01);
        assert.isAtLeast(result, 0.0);
    });

    it("returns 0.0 when starting exactly at 0.0", () => {
        assert.equal(applyIncorrect(0.0), 0.0);
    });

    it("respects a custom decrement factor", () => {
        const defaultResult = applyIncorrect(0.5);
        const customResult = applyIncorrect(0.5, 0.5);
        assert.isBelow(customResult, defaultResult);
        assert.equal(customResult, 0.25);
    });
});

describe("isMastered", () => {

    it("returns true when the score is exactly at the mastery threshold", () => {
        assert.isTrue(isMastered(MASTERY_THRESHOLD));
    });

    it("returns true when the score is above the mastery threshold", () => {
        assert.isTrue(isMastered(0.95));
    });

    it("returns false when the score is below the mastery threshold", () => {
        assert.isFalse(isMastered(0.79));
    });

    it("respects a custom threshold", () => {
        assert.isTrue(isMastered(0.6, 0.5));
        assert.isFalse(isMastered(0.6, 0.7));
    });
});

describe("SRS trajectory example (documents expected numerical behavior from a 0.5 starting point)", () => {

    it("two correct answers followed by one incorrect answer follows the documented trajectory", () => {
        let score = 0.5;

        score = applyCorrect(score);
        assert.approximately(score, 0.56, 0.005);

        score = applyCorrect(score);
        assert.approximately(score, 0.6128, 0.005);

        score = applyIncorrect(score);
        assert.approximately(score, 0.5025, 0.005);
    });
});
