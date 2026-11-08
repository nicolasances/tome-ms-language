import { assert } from "chai";
import { ObjectId } from "mongodb";
import { WordsPracticeAttempt, WordsPracticeSession, WordsPracticeWord } from "../../src/model/WordsPracticeSession";

function makeWord(overrides: Partial<ConstructorParameters<typeof WordsPracticeWord>[0]> = {}): WordsPracticeWord {
    return new WordsPracticeWord({
        wordKey: "hus", vocabularyItemIds: ["v1", "v2"], promptItemId: "v1", english: "house", type: "noun", context: null, danish: "et hus",
        attempts: [], firstAttemptCorrect: null, correct: false, firstAttemptResultApplied: false,
        ...overrides,
    });
}

describe("WordsPracticeSession model", () => {

    it("round-trips through toBSON and fromBSON", () => {
        const attempt = new WordsPracticeAttempt({ userAnswer: "hus", isCorrect: true, isFirstAttempt: true, aiChecked: false, timestamp: "2026-11-08T10:00:00.000Z" });
        const session = new WordsPracticeSession({
            userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z", completedAt: null,
            words: [makeWord({ attempts: [attempt], firstAttemptCorrect: true, correct: true, firstAttemptResultApplied: true })],
            lastAnsweredWordKey: "hus",
        });
        const oid = new ObjectId();

        const restored = WordsPracticeSession.fromBSON({ ...session.toBSON(), _id: oid });

        assert.equal(restored.id, oid.toString());
        assert.equal(restored.status, "in_progress");
        assert.equal(restored.lastAnsweredWordKey, "hus");
        assert.deepEqual(restored.words[0].toBSON(), session.words[0].toBSON());
        assert.instanceOf(restored.words[0].attempts[0], WordsPracticeAttempt);
    });

    it("defaults optional fields when reading a minimal document", () => {
        const restored = WordsPracticeSession.fromBSON({ _id: new ObjectId(), userId: "u1", status: "in_progress", startedAt: "2026-11-08T09:00:00.000Z" });

        assert.isNull(restored.completedAt);
        assert.deepEqual(restored.words, []);
        assert.isNull(restored.lastAnsweredWordKey);
    });

    it("serializes without an _id so Mongo generates it", () => {
        const session = new WordsPracticeSession({ userId: "u1", status: "in_progress", startedAt: "x", completedAt: null, words: [], lastAnsweredWordKey: null });

        assert.notProperty(session.toBSON(), "_id");
    });
});
