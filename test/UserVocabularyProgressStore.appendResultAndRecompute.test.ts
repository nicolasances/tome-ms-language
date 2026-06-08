import { assert } from "chai";
import { ExerciseResult } from "../src/model/ExerciseResult";
import { UserVocabularyProgress } from "../src/model/UserVocabularyProgress";
import { UserVocabularyProgressStore } from "../src/store/UserVocabularyProgressStore";
import { applyCorrect, applyIncorrect } from "../src/util/SrsAlgorithm";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserVocabularyProgress>[0]> = {}): UserVocabularyProgress {
    return new UserVocabularyProgress({
        userId: "user-1",
        vocabularyItemId: "A1-01-v-hund-1234",
        masteryScore: 0.5,
        lastReviewed: "2026-05-01T09:00:00.000Z",
        exerciseHistory: [],
        ...overrides,
    });
}

function makeResult(overrides: Partial<ConstructorParameters<typeof ExerciseResult>[0]> = {}): ExerciseResult {
    return new ExerciseResult({
        exerciseId: "ex-1",
        type: "multiple_choice",
        isCorrect: true,
        userAnswer: "hund",
        correctAnswer: "hund",
        timestamp: "2026-06-01T10:00:00.000Z",
        moduleId: "mod-1",
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {
    return {
        findOne: async (filter: any) =>
            docs.find(d => d.userId === filter.userId && d.vocabularyItemId === filter.vocabularyItemId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = docs.findIndex(d => d.userId === doc.userId && d.vocabularyItemId === doc.vocabularyItemId);
            if (idx >= 0) docs[idx] = doc; else docs.push(doc);
            return {};
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserVocabularyProgressStore.appendResultAndRecompute", () => {

    it("creates a new record (starting from 0.0) when the item has never been reviewed before", async () => {
        const docs: any[] = [];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: true, timestamp: "2026-06-01T10:00:00.000Z" });

        const updated = await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", result);

        assert.equal(updated.userId, "user-1");
        assert.equal(updated.vocabularyItemId, "A1-01-v-hund-1234");
        assert.approximately(updated.masteryScore, applyCorrect(0.0), 1e-9);
        assert.equal(updated.exerciseHistory.length, 1);
    });

    it("increases the score and appends to history on a correct answer", async () => {
        const docs = [makeProgress({ masteryScore: 0.5, exerciseHistory: [] }).toBSON()];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: true });

        const updated = await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", result);

        assert.approximately(updated.masteryScore, applyCorrect(0.5), 1e-9);
        assert.equal(updated.exerciseHistory.length, 1);
        assert.equal(updated.exerciseHistory[0].exerciseId, "ex-1");
    });

    it("decreases the score on an incorrect answer", async () => {
        const docs = [makeProgress({ masteryScore: 0.5, exerciseHistory: [] }).toBSON()];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ isCorrect: false, userAnswer: "kat" });

        const updated = await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", result);

        assert.approximately(updated.masteryScore, applyIncorrect(0.5), 1e-9);
    });

    it("sets lastReviewed to the result's timestamp", async () => {
        const docs = [makeProgress({ lastReviewed: "2026-05-01T09:00:00.000Z" }).toBSON()];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });
        const result = makeResult({ timestamp: "2026-06-15T14:30:00.000Z" });

        const updated = await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", result);

        assert.equal(updated.lastReviewed, "2026-06-15T14:30:00.000Z");
    });

    it("accumulates multiple results across calls, recomputing the score each time", async () => {
        const docs: any[] = [];
        const store = new UserVocabularyProgressStore({ db: makeMockDb(makeMockCollection(docs)), config: {} as any });

        await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", makeResult({ exerciseId: "ex-1", isCorrect: true }));
        const final = await store.appendResultAndRecompute("user-1", "A1-01-v-hund-1234", makeResult({ exerciseId: "ex-2", isCorrect: true }));

        const expected = applyCorrect(applyCorrect(0.0));
        assert.approximately(final.masteryScore, expected, 1e-9);
        assert.equal(final.exerciseHistory.length, 2);
        assert.deepEqual(final.exerciseHistory.map(r => r.exerciseId), ["ex-1", "ex-2"]);
    });
});
