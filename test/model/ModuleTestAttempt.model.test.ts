import { strict as assert } from "assert";
import { ObjectId } from "mongodb";
import { ModuleTestAttempt } from "../../src/model/ModuleTestAttempt";
import { ExerciseResult } from "../../src/model/ExerciseResult";

function makeResult(exerciseId: string, isCorrect: boolean): ExerciseResult {
    return new ExerciseResult({
        exerciseId,
        type: "translation_active",
        isCorrect,
        userAnswer: "hej",
        correctAnswer: "hej",
        timestamp: "2026-06-11T10:00:00.000Z",
        moduleId: "mod-1",
    });
}

describe("ModuleTestAttempt.fromBSON", () => {

    it("round-trips all fields through toBSON / fromBSON", () => {

        const oid = new ObjectId();

        const attempt = new ModuleTestAttempt({
            userId: "user-1",
            moduleId: "mod-1",
            exerciseIds: ["ex-1", "ex-2"],
            answers: [{ exerciseId: "ex-1", isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-11T10:00:00.000Z" }],
            currentPosition: 1,
            verifiedExerciseIds: [],
            score: null,
            passed: null,
            startedAt: "2026-06-11T09:00:00.000Z",
            takenAt: null,
            exerciseResults: [],
        });

        // Simulate a round-trip through MongoDB (fromBSON expects a WithId doc)
        const bson = { _id: oid, ...attempt.toBSON() };
        const result = ModuleTestAttempt.fromBSON(bson as any);

        assert.equal(result.id, oid.toString());
        assert.equal(result.userId, "user-1");
        assert.equal(result.moduleId, "mod-1");
        assert.deepEqual(result.exerciseIds, ["ex-1", "ex-2"]);
        assert.equal(result.answers.length, 1);
        assert.equal(result.answers[0].exerciseId, "ex-1");
        assert.equal(result.currentPosition, 1);
        assert.deepEqual(result.verifiedExerciseIds, []);
        assert.equal(result.score, null);
        assert.equal(result.passed, null);
        assert.equal(result.startedAt, "2026-06-11T09:00:00.000Z");
        assert.equal(result.takenAt, null);
    });

    it("round-trips a submitted attempt with score and passed", () => {

        const oid = new ObjectId();
        const attempt = new ModuleTestAttempt({
            userId: "user-1",
            moduleId: "mod-1",
            exerciseIds: ["ex-1"],
            startedAt: "2026-06-11T09:00:00.000Z",
            score: 85,
            passed: true,
            takenAt: "2026-06-11T10:00:00.000Z",
            exerciseResults: [makeResult("ex-1", true)],
        });

        const bson = { _id: oid, ...attempt.toBSON() };
        const result = ModuleTestAttempt.fromBSON(bson as any);

        assert.equal(result.score, 85);
        assert.equal(result.passed, true);
        assert.equal(result.takenAt, "2026-06-11T10:00:00.000Z");
        assert.equal(result.exerciseResults.length, 1);
        assert.equal(result.exerciseResults[0].exerciseId, "ex-1");
    });

    it("defaults arrays and position when absent from the document", () => {

        const oid = new ObjectId();
        const doc: any = {
            _id: oid,
            userId: "user-1",
            moduleId: "mod-1",
            startedAt: "2026-06-11T09:00:00.000Z",
        };

        const result = ModuleTestAttempt.fromBSON(doc);

        assert.deepEqual(result.exerciseIds, []);
        assert.deepEqual(result.answers, []);
        assert.equal(result.currentPosition, 0);
        assert.deepEqual(result.verifiedExerciseIds, []);
        assert.equal(result.score, null);
        assert.equal(result.passed, null);
        assert.equal(result.takenAt, null);
        assert.deepEqual(result.exerciseResults, []);
    });
});
