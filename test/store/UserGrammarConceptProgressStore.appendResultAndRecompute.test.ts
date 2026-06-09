import { assert } from "chai";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { UserGrammarConceptProgress } from "../../src/model/UserGrammarConceptProgress";
import { UserGrammarConceptProgressStore } from "../../src/store/UserGrammarConceptProgressStore";
import { applyCorrect, applyIncorrect } from "../../src/util/SrsAlgorithm";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserGrammarConceptProgress>[0]> = {}): UserGrammarConceptProgress {
    return new UserGrammarConceptProgress({
        userId: "user-1",
        grammarConceptId: "gc-inversion",
        masteryScore: 0.5,
        lastReviewed: "2026-05-01T09:00:00.000Z",
        exerciseHistory: [],
        ...overrides,
    });
}

function makeResult(overrides: Partial<ConstructorParameters<typeof ExerciseResult>[0]> = {}): ExerciseResult {
    return new ExerciseResult({
        exerciseId: "ex-1",
        type: "error_correction",
        isCorrect: true,
        userAnswer: "Jeg kan ikke",
        correctAnswer: "Jeg kan ikke",
        timestamp: "2026-06-01T10:00:00.000Z",
        moduleId: "mod-1",
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.grammarConceptId === filter.grammarConceptId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.grammarConceptId === doc.grammarConceptId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserGrammarConceptProgressStore.appendResultAndRecompute", () => {

    it("creates a new record (starting from 0.0) when the concept has never been reviewed before", async () => {
        const docs: any[] = [];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: true, timestamp: "2026-06-01T10:00:00.000Z" });

        const updated = await store.appendResultAndRecompute("user-1", "gc-inversion", result);

        assert.equal(updated.userId, "user-1");
        assert.equal(updated.grammarConceptId, "gc-inversion");
        assert.approximately(updated.masteryScore, applyCorrect(0.0), 1e-9);
        assert.equal(updated.exerciseHistory.length, 1);
    });

    it("increases the score and appends to history on a correct answer", async () => {
        const docs = [makeProgress({ masteryScore: 0.5, exerciseHistory: [] }).toBSON()];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: true });

        const updated = await store.appendResultAndRecompute("user-1", "gc-inversion", result);

        assert.approximately(updated.masteryScore, applyCorrect(0.5), 1e-9);
        assert.equal(updated.exerciseHistory.length, 1);
        assert.equal(updated.exerciseHistory[0].exerciseId, "ex-1");
    });

    it("decreases the score on an incorrect answer", async () => {
        const docs = [makeProgress({ masteryScore: 0.5, exerciseHistory: [] }).toBSON()];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: false, userAnswer: "Jeg ikke kan" });

        const updated = await store.appendResultAndRecompute("user-1", "gc-inversion", result);

        assert.approximately(updated.masteryScore, applyIncorrect(0.5), 1e-9);
    });

    it("sets lastReviewed to the result's timestamp", async () => {
        const docs = [makeProgress({ lastReviewed: "2026-05-01T09:00:00.000Z" }).toBSON()];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ timestamp: "2026-06-15T14:30:00.000Z" });

        const updated = await store.appendResultAndRecompute("user-1", "gc-inversion", result);

        assert.equal(updated.lastReviewed, "2026-06-15T14:30:00.000Z");
    });

    it("accumulates multiple results across calls, recomputing the score each time", async () => {
        const docs: any[] = [];
        const store = new UserGrammarConceptProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        await store.appendResultAndRecompute("user-1", "gc-inversion", makeResult({ exerciseId: "ex-1", isCorrect: true }));
        const final = await store.appendResultAndRecompute("user-1", "gc-inversion", makeResult({ exerciseId: "ex-2", isCorrect: true }));

        const expected = applyCorrect(applyCorrect(0.0));
        assert.approximately(final.masteryScore, expected, 1e-9);
        assert.equal(final.exerciseHistory.length, 2);
        assert.deepEqual(final.exerciseHistory.map(r => r.exerciseId), ["ex-1", "ex-2"]);
    });
});
