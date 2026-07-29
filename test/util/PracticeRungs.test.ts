import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { FIRST_PRACTICE_RUNG, LAST_PRACTICE_RUNG } from "../../src/Config";
import { exercisesAtRung, linkedItemIdOf, rungOfType } from "../../src/util/PracticeRungs";

function makeExercise(overrides: Partial<ConstructorParameters<typeof Exercise>[0]> = {}): Exercise {
    return new Exercise({ id: "ex-1", moduleId: "mod-1", type: "multiple_choice", prompt: "p", answer: "a", vocabularyItemId: "v-1", ...overrides });
}

describe("rungOfType", () => {

    it("places multiple_choice at rung 1 (recognition)", () => {
        assert.equal(rungOfType("multiple_choice"), 1);
    });

    it("places sentence_reorder at rung 1 because the tiles are supplied", () => {
        assert.equal(rungOfType("sentence_reorder"), 1);
    });

    it("places fill_blank at rung 2 (cued production)", () => {
        assert.equal(rungOfType("fill_blank"), 2);
    });

    it("places conjugation_drill at rung 2 (cued production)", () => {
        assert.equal(rungOfType("conjugation_drill"), 2);
    });

    it("places translation_active at rung 3 (free production)", () => {
        assert.equal(rungOfType("translation_active"), 3);
    });

    it("places error_correction at rung 3 (free production)", () => {
        assert.equal(rungOfType("error_correction"), 3);
    });

    it("returns null for a type that is not in the rung map", () => {
        assert.isNull(rungOfType("some_future_type"));
    });

    it("maps every rung between the first and the last to at least one type", () => {

        for (let rung = FIRST_PRACTICE_RUNG; rung <= LAST_PRACTICE_RUNG; rung++) {
            const types = ["multiple_choice", "sentence_reorder", "fill_blank", "conjugation_drill", "translation_active", "error_correction"].filter(t => rungOfType(t) === rung);

            assert.isAbove(types.length, 0, `rung ${rung} has no exercise type`);
        }
    });
});

describe("linkedItemIdOf", () => {

    it("returns the vocabularyItemId for a vocabulary-linked exercise", () => {
        assert.equal(linkedItemIdOf(makeExercise({ vocabularyItemId: "v-9", grammarConceptId: null })), "v-9");
    });

    it("returns the grammarConceptId for a grammar-linked exercise", () => {
        assert.equal(linkedItemIdOf(makeExercise({ type: "sentence_reorder", vocabularyItemId: null, grammarConceptId: "g-3" })), "g-3");
    });
});

describe("exercisesAtRung", () => {

    it("keeps only the exercises whose type belongs to the requested rung", () => {

        const pool = [
            makeExercise({ id: "mc", type: "multiple_choice" }),
            makeExercise({ id: "fb", type: "fill_blank" }),
            makeExercise({ id: "ta", type: "translation_active" }),
            makeExercise({ id: "sr", type: "sentence_reorder", vocabularyItemId: null, grammarConceptId: "g-1" }),
        ];

        const result = exercisesAtRung(pool, 1);

        assert.deepEqual(result.map(e => e.id), ["mc", "sr"]);
    });

    it("returns an empty array when the pool holds no exercise at that rung", () => {

        const pool = [makeExercise({ id: "mc", type: "multiple_choice" })];

        assert.deepEqual(exercisesAtRung(pool, 3), []);
    });

    it("excludes exercises of an unknown type from every rung", () => {

        const pool = [makeExercise({ id: "weird", type: "some_future_type" })];

        assert.deepEqual(exercisesAtRung(pool, 1), []);
        assert.deepEqual(exercisesAtRung(pool, 2), []);
        assert.deepEqual(exercisesAtRung(pool, 3), []);
    });
});
