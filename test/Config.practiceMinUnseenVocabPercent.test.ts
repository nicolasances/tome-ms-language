import { assert } from "chai";
import { PRACTICE_MIN_UNSEEN_VOCAB_PERCENT } from "../src/Config";

describe("PRACTICE_MIN_UNSEEN_VOCAB_PERCENT", () => {

    it("defaults to 50", () => {

        assert.equal(PRACTICE_MIN_UNSEEN_VOCAB_PERCENT, 50);
    });

    it("is a percentage in the [0, 100] range", () => {

        assert.isAtLeast(PRACTICE_MIN_UNSEEN_VOCAB_PERCENT, 0);
        assert.isAtMost(PRACTICE_MIN_UNSEEN_VOCAB_PERCENT, 100);
    });
});
