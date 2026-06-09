import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { scoreExercisePool } from "../../src/util/ExerciseSelector";
import { DEPRIORITIZE_MASTERY_THRESHOLD, RECENT_MISS_BOOST } from "../../src/Config";

function makeExercise(overrides: Partial<ConstructorParameters<typeof Exercise>[0]> = {}): Exercise {

    return new Exercise({
        id: "ex-001",
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "Write 'hello' in Danish",
        promptTranslation: null,
        answer: "hej",
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
        ...overrides,
    });
}

describe("scoreExercisePool", () => {

    describe("mastery resolution", () => {

        it("resolves mastery from the vocabulary item linked to the exercise", () => {

            const exercise = makeExercise({ id: "ex-vocab", vocabularyItemId: "vocab-1", grammarConceptId: null });
            const masteryByItemId = new Map([["vocab-1", 0.4]]);

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId, recentMisses: new Set(), targetCount: 5 });

            assert.equal(scored.linkedItemId, "vocab-1");
            assert.equal(scored.weight, 0.6);
        });

        it("resolves mastery from the grammar concept linked to the exercise", () => {

            const exercise = makeExercise({ id: "ex-grammar", type: "sentence_reorder", vocabularyItemId: null, grammarConceptId: "grammar-1" });
            const masteryByItemId = new Map([["grammar-1", 0.3]]);

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId, recentMisses: new Set(), targetCount: 5 });

            assert.equal(scored.linkedItemId, "grammar-1");
            assert.equal(scored.weight, 0.7);
        });

        it("treats a linked item absent from the mastery map as never reviewed (masteryScore 0)", () => {

            const exercise = makeExercise({ id: "ex-unseen", vocabularyItemId: "vocab-unseen", grammarConceptId: null });

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 5 });

            assert.equal(scored.weight, 1);
        });
    });

    describe("deprioritization", () => {

        it(`excludes exercises whose linked item mastery is above ${DEPRIORITIZE_MASTERY_THRESHOLD} when the pool has enough other exercises`, () => {

            const mastered = makeExercise({ id: "ex-mastered", vocabularyItemId: "vocab-mastered" });
            const weak = makeExercise({ id: "ex-weak", vocabularyItemId: "vocab-weak" });
            const masteryByItemId = new Map([["vocab-mastered", 0.9], ["vocab-weak", 0.2]]);

            const scored = scoreExercisePool({ pool: [mastered, weak], masteryByItemId, recentMisses: new Set(), targetCount: 1 });

            assert.lengthOf(scored, 1);
            assert.equal(scored[0].exercise.id, "ex-weak");
        });

        it(`keeps exercises at exactly the ${DEPRIORITIZE_MASTERY_THRESHOLD} threshold (only scores strictly above as deprioritized)`, () => {

            const atThreshold = makeExercise({ id: "ex-at-threshold", vocabularyItemId: "vocab-at-threshold" });
            const filler = makeExercise({ id: "ex-filler", vocabularyItemId: "vocab-filler" });
            const masteryByItemId = new Map([["vocab-at-threshold", DEPRIORITIZE_MASTERY_THRESHOLD], ["vocab-filler", 0.1]]);

            const scored = scoreExercisePool({ pool: [atThreshold, filler], masteryByItemId, recentMisses: new Set(), targetCount: 1 });

            assert.include(scored.map(s => s.exercise.id), "ex-at-threshold");
        });

        it("falls back to including deprioritized exercises when too few non-deprioritized exercises remain to fill the session", () => {

            const mastered1 = makeExercise({ id: "ex-mastered-1", vocabularyItemId: "vocab-mastered-1" });
            const mastered2 = makeExercise({ id: "ex-mastered-2", vocabularyItemId: "vocab-mastered-2" });
            const weak = makeExercise({ id: "ex-weak", vocabularyItemId: "vocab-weak" });
            const masteryByItemId = new Map([["vocab-mastered-1", 0.9], ["vocab-mastered-2", 0.95], ["vocab-weak", 0.2]]);

            const scored = scoreExercisePool({ pool: [mastered1, mastered2, weak], masteryByItemId, recentMisses: new Set(), targetCount: 3 });

            assert.lengthOf(scored, 3);
            assert.includeMembers(scored.map(s => s.exercise.id), ["ex-mastered-1", "ex-mastered-2", "ex-weak"]);
        });
    });

    describe("weight computation", () => {

        it("weighs an exercise by (1 - masteryScore)", () => {

            const exercise = makeExercise({ id: "ex-001", vocabularyItemId: "vocab-1" });
            const masteryByItemId = new Map([["vocab-1", 0.35]]);

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId, recentMisses: new Set(), targetCount: 5 });

            assert.approximately(scored.weight, 0.65, 1e-9);
        });

        it(`adds RECENT_MISS_BOOST (${RECENT_MISS_BOOST}) to the weight of exercises the user got wrong in the most recent session`, () => {

            const exercise = makeExercise({ id: "ex-recent-miss", vocabularyItemId: "vocab-1" });
            const masteryByItemId = new Map([["vocab-1", 0.35]]);

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId, recentMisses: new Set(["ex-recent-miss"]), targetCount: 5 });

            assert.approximately(scored.weight, 0.65 + RECENT_MISS_BOOST, 1e-9);
        });

        it("does not boost exercises that are not in the recent-misses set", () => {

            const exercise = makeExercise({ id: "ex-not-missed", vocabularyItemId: "vocab-1" });
            const masteryByItemId = new Map([["vocab-1", 0.35]]);

            const [scored] = scoreExercisePool({ pool: [exercise], masteryByItemId, recentMisses: new Set(["some-other-exercise"]), targetCount: 5 });

            assert.approximately(scored.weight, 0.65, 1e-9);
        });
    });
});
