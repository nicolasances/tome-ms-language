import { assert } from "chai";
import { checkWordAnswer } from "../../src/util/WordAnswerChecker";

describe("WordAnswerChecker.checkWordAnswer", () => {

    it("accepts an exact match", () => {
        assert.isTrue(checkWordAnswer({ userAnswer: "arbejde", canonical: "arbejde" }));
    });

    it("ignores case, punctuation and a leading at/en/et", () => {
        assert.isTrue(checkWordAnswer({ userAnswer: "at arbejde", canonical: "arbejde" }));
        assert.isTrue(checkWordAnswer({ userAnswer: "Arbejde.", canonical: "arbejde" }));
        assert.isTrue(checkWordAnswer({ userAnswer: "et hus", canonical: "hus" }));
        assert.isTrue(checkWordAnswer({ userAnswer: "hus", canonical: "et hus" }));
    });

    it("requires an exact match when the canonical form is 4 characters or fewer", () => {
        assert.isFalse(checkWordAnswer({ userAnswer: "med", canonical: "mad" }));
        assert.isFalse(checkWordAnswer({ userAnswer: "få", canonical: "gå" }));
        assert.isFalse(checkWordAnswer({ userAnswer: "kat", canonical: "kan" }));
        assert.isFalse(checkWordAnswer({ userAnswer: "hund", canonical: "hunt" }));
    });

    it("accepts a one-edit typo on a canonical form longer than 4 characters", () => {
        assert.isTrue(checkWordAnswer({ userAnswer: "arbjde", canonical: "arbejde" }));
        assert.isTrue(checkWordAnswer({ userAnswer: "huset", canonical: "husex" }));
    });

    it("rejects a two-edit typo on a canonical form of up to 10 characters", () => {
        assert.isFalse(checkWordAnswer({ userAnswer: "arbde", canonical: "arbejde" }));
    });

    it("allows two edits on canonical forms of 11 to 20 characters", () => {
        assert.isTrue(checkWordAnswer({ userAnswer: "virksomhedsledere", canonical: "virksomhedsleder" }));
        assert.isTrue(checkWordAnswer({ userAnswer: "virksomhedsldr", canonical: "virksomhedsleder" }));
    });

    it("rejects an empty answer", () => {
        assert.isFalse(checkWordAnswer({ userAnswer: "", canonical: "arbejde" }));
    });
});
