import { strict as assert } from "assert";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { UserVocabularyProgress } from "../../src/model/UserVocabularyProgress";

describe("ExerciseResult.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const result = new ExerciseResult({
            exerciseId: "ex-1",
            type: "multiple_choice",
            isCorrect: true,
            userAnswer: "hund",
            correctAnswer: "hund",
            timestamp: "2026-06-01T10:00:00.000Z",
            moduleId: "mod-1",
        });

        const round = ExerciseResult.fromBSON(result.toBSON());

        assert.equal(round.exerciseId, "ex-1");
        assert.equal(round.type, "multiple_choice");
        assert.equal(round.isCorrect, true);
        assert.equal(round.userAnswer, "hund");
        assert.equal(round.correctAnswer, "hund");
        assert.equal(round.timestamp, "2026-06-01T10:00:00.000Z");
        assert.equal(round.moduleId, "mod-1");
    });

    it("preserves a null moduleId (level test attempts are not tied to a module)", () => {
        const result = new ExerciseResult({
            exerciseId: "ex-2",
            type: "translation_active",
            isCorrect: false,
            userAnswer: "kat",
            correctAnswer: "hund",
            timestamp: "2026-06-02T08:00:00.000Z",
            moduleId: null,
        });

        const round = ExerciseResult.fromBSON(result.toBSON());

        assert.equal(round.moduleId, null);
    });
});

describe("UserVocabularyProgress.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const progress = new UserVocabularyProgress({
            userId: "user-1",
            vocabularyItemId: "A1-01-v-hund-1234",
            masteryScore: 0.62,
            lastReviewed: "2026-06-01T09:00:00.000Z",
            exerciseHistory: [],
        });

        const round = UserVocabularyProgress.fromBSON(progress.toBSON());

        assert.equal(round.userId, "user-1");
        assert.equal(round.vocabularyItemId, "A1-01-v-hund-1234");
        assert.equal(round.masteryScore, 0.62);
        assert.equal(round.lastReviewed, "2026-06-01T09:00:00.000Z");
        assert.deepEqual(round.exerciseHistory, []);
    });

    it("round-trips embedded exerciseHistory entries", () => {
        const result = new ExerciseResult({
            exerciseId: "ex-1",
            type: "fill_in_the_blank",
            isCorrect: true,
            userAnswer: "spiser",
            correctAnswer: "spiser",
            timestamp: "2026-06-03T12:00:00.000Z",
            moduleId: "mod-1",
        });
        const progress = new UserVocabularyProgress({
            userId: "user-1",
            vocabularyItemId: "A1-01-v-spise-5678",
            masteryScore: 0.74,
            lastReviewed: "2026-06-03T12:00:00.000Z",
            exerciseHistory: [result],
        });

        const round = UserVocabularyProgress.fromBSON(progress.toBSON());

        assert.equal(round.exerciseHistory.length, 1);
        assert.equal(round.exerciseHistory[0].exerciseId, "ex-1");
        assert.equal(round.exerciseHistory[0].isCorrect, true);
    });

    it("defaults exerciseHistory to [] when absent from the document", () => {
        const doc: any = { userId: "user-1", vocabularyItemId: "A1-01-v-hund-1234", masteryScore: 0.5, lastReviewed: null };
        const round = UserVocabularyProgress.fromBSON(doc);

        assert.deepEqual(round.exerciseHistory, []);
    });

    it("handles a null lastReviewed (item never appeared in a test)", () => {
        const progress = new UserVocabularyProgress({
            userId: "user-1",
            vocabularyItemId: "A1-01-v-hund-1234",
            masteryScore: 0.0,
            lastReviewed: null,
            exerciseHistory: [],
        });

        const round = UserVocabularyProgress.fromBSON(progress.toBSON());

        assert.equal(round.lastReviewed, null);
    });
});
