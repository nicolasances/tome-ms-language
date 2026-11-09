import { assert } from "chai";
import { VocabularyItem } from "../../src/model/VocabularyItem";
import { UserVocabularyProgress } from "../../src/model/UserVocabularyProgress";
import { buildWordGroups, computeWordWeight, drawWords } from "../../src/util/WordsPracticePool";

function makeItem(id: string, danish: string, cefrLevel = "A1", english = `en-${id}`): VocabularyItem {
    return new VocabularyItem({ id, danish, english, type: "noun", context: null, cefrLevel, source: "curriculum", addedByUserId: null });
}

function makeProgress(vocabularyItemId: string, masteryScore: number, lastReviewed: string | null): UserVocabularyProgress {
    return new UserVocabularyProgress({ userId: "u1", vocabularyItemId, masteryScore, lastReviewed, exerciseHistory: [] });
}

const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("WordsPracticePool.buildWordGroups", () => {

    it("groups items that share a normalized Danish form into one word", () => {
        const items = [makeItem("a", "Arbejde"), makeItem("b", "at arbejde"), makeItem("c", "hus")];

        const groups = buildWordGroups({ items, progress: [] });

        assert.lengthOf(groups, 2);
        assert.sameMembers(groups.find(g => g.wordKey === "arbejde")!.items.map(i => i.id), ["a", "b"]);
    });

    it("uses the minimum mastery across the group, counting a missing record as 0", () => {
        const items = [makeItem("a", "hus"), makeItem("b", "hus"), makeItem("c", "bil"), makeItem("d", "bil")];
        const progress = [makeProgress("a", 0.9, null), makeProgress("b", 0.4, null), makeProgress("c", 0.8, null)];

        const groups = buildWordGroups({ items, progress });

        assert.equal(groups.find(g => g.wordKey === "hus")!.mastery, 0.4);
        assert.equal(groups.find(g => g.wordKey === "bil")!.mastery, 0);
    });

    it("uses the oldest lastReviewed across the group", () => {
        const items = [makeItem("a", "hus"), makeItem("b", "hus")];
        const progress = [makeProgress("a", 0.5, "2026-11-01T00:00:00.000Z"), makeProgress("b", 0.5, "2026-10-01T00:00:00.000Z")];

        const groups = buildWordGroups({ items, progress });

        assert.equal(groups[0].lastReviewed, "2026-10-01T00:00:00.000Z");
    });

    it("treats an item with no record or a null lastReviewed as never reviewed", () => {
        const items = [makeItem("a", "hus"), makeItem("b", "hus"), makeItem("c", "bil")];
        const progress = [makeProgress("a", 0.5, "2026-11-01T00:00:00.000Z"), makeProgress("c", 0.5, null)];

        const groups = buildWordGroups({ items, progress });

        assert.isNull(groups.find(g => g.wordKey === "hus")!.lastReviewed);
        assert.isNull(groups.find(g => g.wordKey === "bil")!.lastReviewed);
    });

    it("picks the prompt item by lowest CEFR level, then by id", () => {
        const items = [makeItem("z", "hus", "A2"), makeItem("m", "hus", "A1"), makeItem("b", "hus", "A1")];

        const groups = buildWordGroups({ items, progress: [] });

        assert.equal(groups[0].promptItem.id, "b");
    });
});

describe("WordsPracticePool.computeWordWeight", () => {

    const params = { masteryWeight: 0.5, stalenessWeight: 0.5, stalenessHorizonDays: 30, now: NOW };

    it("is 1 for a never-reviewed word with zero mastery", () => {
        const weight = computeWordWeight({ mastery: 0, lastReviewed: null, ...params });

        assert.equal(weight, 1);
    });

    it("is 0 for a fully mastered word reviewed just now", () => {
        const weight = computeWordWeight({ mastery: 1, lastReviewed: NOW.toISOString(), ...params });

        assert.equal(weight, 0);
    });

    it("saturates staleness at the horizon", () => {
        const weight = computeWordWeight({ mastery: 1, lastReviewed: "2025-01-01T00:00:00.000Z", ...params });

        assert.equal(weight, 0.5);
    });

    it("scales staleness linearly below the horizon", () => {
        const weight = computeWordWeight({ mastery: 1, lastReviewed: "2026-10-24T12:00:00.000Z", ...params });

        assert.closeTo(weight, 0.25, 1e-9);
    });
});

describe("WordsPracticePool.drawWords", () => {

    const params = { masteryWeight: 0.5, stalenessWeight: 0.5, stalenessHorizonDays: 30, now: NOW };

    function makeGroups(count: number) {
        const items = Array.from({ length: count }, (_, i) => makeItem(`id-${i}`, `ord${i}`));

        return buildWordGroups({ items, progress: [] });
    }

    it("draws min(size, pool) distinct words", () => {
        const groups = makeGroups(10);

        assert.lengthOf(drawWords({ groups, size: 4, ...params }), 4);
        assert.lengthOf(drawWords({ groups, size: 40, ...params }), 10);
    });

    it("draws low-mastery stale words more often than mastered fresh ones", () => {
        const items = [makeItem("weak", "svag"), makeItem("strong", "stærk")];
        const progress = [makeProgress("weak", 0.0, "2026-01-01T00:00:00.000Z"), makeProgress("strong", 1.0, NOW.toISOString())];
        const groups = buildWordGroups({ items, progress });
        let weakFirst = 0;

        for (let i = 0; i < 300; i++) {
            const drawn = drawWords({ groups, size: 1, ...params });
            if (drawn[0].wordKey === "svag") weakFirst++;
        }

        assert.equal(weakFirst, 300);
    });
});
