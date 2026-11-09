import { assert } from "chai";
import { ExerciseResult } from "../../src/model/ExerciseResult";

describe("ExerciseResult nullable exerciseId", () => {

    const base = { type: "words_practice", isCorrect: true, userAnswer: "hus", correctAnswer: "hus", timestamp: "2026-11-08T10:00:00.000Z", moduleId: null };

    it("round-trips a null exerciseId through toBSON/fromBSON", () => {
        const result = new ExerciseResult({ ...base, exerciseId: null });

        const restored = ExerciseResult.fromBSON(result.toBSON());

        assert.isNull(restored.exerciseId);
        assert.equal(restored.type, "words_practice");
    });

    it("still carries a string exerciseId unchanged", () => {
        const result = new ExerciseResult({ ...base, exerciseId: "ex-1" });

        assert.equal(ExerciseResult.fromBSON(result.toBSON()).exerciseId, "ex-1");
    });

    it("reads a legacy document without exerciseId as null", () => {
        assert.isNull(ExerciseResult.fromBSON({ ...base, exerciseId: undefined }).exerciseId);
    });
});
