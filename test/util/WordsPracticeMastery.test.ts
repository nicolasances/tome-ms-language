import { assert } from "chai";
import { WordsPracticeAttempt, WordsPracticeSession, WordsPracticeWord } from "../../src/model/WordsPracticeSession";
import { UserVocabularyProgressStore } from "../../src/store/UserVocabularyProgressStore";
import { WordsPracticeMastery } from "../../src/util/WordsPracticeMastery";
import { applyCorrect, applyIncorrect } from "../../src/util/SrsAlgorithm";
import { FakeDb } from "../helpers/FakeDb";

const NOW = "2026-11-08T10:00:00.000Z";

function makeWord(overrides: Partial<ConstructorParameters<typeof WordsPracticeWord>[0]> = {}): WordsPracticeWord {
    return new WordsPracticeWord({
        wordKey: "hus", vocabularyItemIds: ["v1", "v2"], promptItemId: "v1", english: "house", type: "noun", context: null, danish: "hus",
        attempts: [], firstAttemptCorrect: null, correct: false, firstAttemptResultApplied: false,
        ...overrides,
    });
}

function wrongFirstAttempt(wordKey: string, ids: string[]): WordsPracticeWord {
    return makeWord({
        wordKey, vocabularyItemIds: ids,
        attempts: [new WordsPracticeAttempt({ userAnswer: "huus", isCorrect: false, isFirstAttempt: true, aiChecked: false, timestamp: NOW })],
        firstAttemptCorrect: false,
    });
}

function setup() {
    const db = new FakeDb();
    const store = new UserVocabularyProgressStore({ db: db as any, config: {} as any });

    return { db, mastery: new WordsPracticeMastery({ vocabularyProgressStore: store }) };
}

describe("WordsPracticeMastery.writeFirstAttempt", () => {

    it("appends one words_practice result with null exerciseId and moduleId to every item in the group", async () => {
        const { db, mastery } = setup();
        const word = makeWord();

        await mastery.writeFirstAttempt({ userId: "u1", word, isCorrect: true, userAnswer: "hus", timestamp: NOW });

        const docs = db.collections["userVocabularyProgress"];

        assert.sameMembers(docs.map(d => d.vocabularyItemId), ["v1", "v2"]);
        assert.equal(docs[0].masteryScore, applyCorrect(0));
        assert.deepInclude(docs[0].exerciseHistory[0], { type: "words_practice", exerciseId: null, moduleId: null, isCorrect: true, userAnswer: "hus", correctAnswer: "hus" });
        assert.isTrue(word.firstAttemptResultApplied);
    });

    it("applies the incorrect update when the outcome is wrong", async () => {
        const { db, mastery } = setup();

        await mastery.writeFirstAttempt({ userId: "u1", word: makeWord(), isCorrect: false, userAnswer: "huus", timestamp: NOW });

        assert.equal(db.collections["userVocabularyProgress"][0].masteryScore, applyIncorrect(0));
    });
});

describe("WordsPracticeMastery.flushPending", () => {

    function sessionWith(words: WordsPracticeWord[]): WordsPracticeSession {
        return new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: NOW, completedAt: null, words, lastAnsweredWordKey: null });
    }

    it("writes a pending wrong first attempt as incorrect, once", async () => {
        const { db, mastery } = setup();
        const word = wrongFirstAttempt("hus", ["v1"]);
        const session = sessionWith([word]);

        const first = await mastery.flushPending({ session, timestamp: NOW });
        const second = await mastery.flushPending({ session, timestamp: NOW });

        assert.isTrue(first);
        assert.isFalse(second);
        assert.isTrue(word.firstAttemptResultApplied);
        assert.lengthOf(db.collections["userVocabularyProgress"][0].exerciseHistory, 1);
        assert.isFalse(db.collections["userVocabularyProgress"][0].exerciseHistory[0].isCorrect);
    });

    it("ignores words that are unanswered or already applied", async () => {
        const { db, mastery } = setup();
        const applied = wrongFirstAttempt("bil", ["v2"]);
        applied.firstAttemptResultApplied = true;
        const session = sessionWith([makeWord(), applied]);

        const changed = await mastery.flushPending({ session, timestamp: NOW });

        assert.isFalse(changed);
        assert.deepEqual(db.collections, {});
    });
});
