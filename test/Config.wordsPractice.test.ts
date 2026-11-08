import { assert } from "chai";
import { WORDS_PRACTICE_MASTERY_WEIGHT, WORDS_PRACTICE_SESSION_SIZE, WORDS_PRACTICE_STALENESS_HORIZON_DAYS, WORDS_PRACTICE_STALENESS_WEIGHT } from "../src/Config";

describe("Config Words Practice constants (F26)", () => {

    it("defaults match the F26 spec", () => {
        assert.equal(WORDS_PRACTICE_SESSION_SIZE, 40);
        assert.equal(WORDS_PRACTICE_MASTERY_WEIGHT, 0.5);
        assert.equal(WORDS_PRACTICE_STALENESS_WEIGHT, 0.5);
        assert.equal(WORDS_PRACTICE_STALENESS_HORIZON_DAYS, 30);
    });
});
