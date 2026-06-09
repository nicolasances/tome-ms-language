import { strict as assert } from "assert";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { UserGrammarConceptProgress } from "../../src/model/UserGrammarConceptProgress";

describe("UserGrammarConceptProgress.fromBSON", () => {

    it("round-trips all fields through toBSON and fromBSON", () => {
        const progress = new UserGrammarConceptProgress({
            userId: "user-1",
            grammarConceptId: "gc-inversion",
            masteryScore: 0.45,
            lastReviewed: "2026-06-01T09:00:00.000Z",
            exerciseHistory: [],
        });

        const round = UserGrammarConceptProgress.fromBSON(progress.toBSON());

        assert.equal(round.userId, "user-1");
        assert.equal(round.grammarConceptId, "gc-inversion");
        assert.equal(round.masteryScore, 0.45);
        assert.equal(round.lastReviewed, "2026-06-01T09:00:00.000Z");
        assert.deepEqual(round.exerciseHistory, []);
    });

    it("round-trips embedded exerciseHistory entries", () => {
        const result = new ExerciseResult({
            exerciseId: "ex-9",
            type: "error_correction",
            isCorrect: false,
            userAnswer: "Jeg ikke kan",
            correctAnswer: "Jeg kan ikke",
            timestamp: "2026-06-04T10:00:00.000Z",
            moduleId: "mod-3",
        });
        const progress = new UserGrammarConceptProgress({
            userId: "user-1",
            grammarConceptId: "gc-negation-placement",
            masteryScore: 0.3,
            lastReviewed: "2026-06-04T10:00:00.000Z",
            exerciseHistory: [result],
        });

        const round = UserGrammarConceptProgress.fromBSON(progress.toBSON());

        assert.equal(round.exerciseHistory.length, 1);
        assert.equal(round.exerciseHistory[0].exerciseId, "ex-9");
        assert.equal(round.exerciseHistory[0].isCorrect, false);
    });

    it("defaults exerciseHistory to [] when absent from the document", () => {
        const doc: any = { userId: "user-1", grammarConceptId: "gc-inversion", masteryScore: 0.5, lastReviewed: null };
        const round = UserGrammarConceptProgress.fromBSON(doc);

        assert.deepEqual(round.exerciseHistory, []);
    });

    it("handles a null lastReviewed (concept never appeared in a test)", () => {
        const progress = new UserGrammarConceptProgress({
            userId: "user-1",
            grammarConceptId: "gc-inversion",
            masteryScore: 0.0,
            lastReviewed: null,
            exerciseHistory: [],
        });

        const round = UserGrammarConceptProgress.fromBSON(progress.toBSON());

        assert.equal(round.lastReviewed, null);
    });
});
