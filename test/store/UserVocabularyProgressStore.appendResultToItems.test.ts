import { assert } from "chai";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { UserVocabularyProgressStore } from "../../src/store/UserVocabularyProgressStore";
import { applyCorrect, applyIncorrect } from "../../src/util/SrsAlgorithm";
import { FakeDb } from "../helpers/FakeDb";

function makeResult(isCorrect: boolean): ExerciseResult {
    return new ExerciseResult({ exerciseId: null, type: "words_practice", isCorrect, userAnswer: "hus", correctAnswer: "hus", timestamp: "2026-11-08T10:00:00.000Z", moduleId: null });
}

function progressDoc(vocabularyItemId: string, masteryScore: number): any {
    return { userId: "u1", vocabularyItemId, masteryScore, lastReviewed: "2026-01-01T00:00:00.000Z", exerciseHistory: [] };
}

describe("UserVocabularyProgressStore.appendResultToItems", () => {

    it("updates every item, creating records for items never reviewed", async () => {
        const db = new FakeDb({ userVocabularyProgress: [progressDoc("v1", 0.5)] });
        const store = new UserVocabularyProgressStore({ db: db as any, config: {} as any });

        await store.appendResultToItems("u1", ["v1", "v2"], makeResult(true));

        const docs = db.collections["userVocabularyProgress"];
        const v1 = docs.find(d => d.vocabularyItemId === "v1");
        const v2 = docs.find(d => d.vocabularyItemId === "v2");

        assert.equal(v1.masteryScore, applyCorrect(0.5));
        assert.equal(v2.masteryScore, applyCorrect(0));
        assert.lengthOf(v1.exerciseHistory, 1);
        assert.lengthOf(v2.exerciseHistory, 1);
    });

    it("applies the incorrect update and stamps lastReviewed", async () => {
        const db = new FakeDb({ userVocabularyProgress: [progressDoc("v1", 0.5)] });
        const store = new UserVocabularyProgressStore({ db: db as any, config: {} as any });

        await store.appendResultToItems("u1", ["v1"], makeResult(false));

        const doc = db.collections["userVocabularyProgress"][0];

        assert.equal(doc.masteryScore, applyIncorrect(0.5));
        assert.equal(doc.lastReviewed, "2026-11-08T10:00:00.000Z");
        assert.isNull(doc.exerciseHistory[0].exerciseId);
    });

    it("does nothing for an empty item list", async () => {
        const db = new FakeDb();
        const store = new UserVocabularyProgressStore({ db: db as any, config: {} as any });

        await store.appendResultToItems("u1", [], makeResult(true));

        assert.deepEqual(db.collections, {});
    });
});
