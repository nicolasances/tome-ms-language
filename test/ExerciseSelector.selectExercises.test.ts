import { assert } from "chai";
import { Exercise } from "../src/model/Exercise";
import { selectExercises } from "../src/util/ExerciseSelector";

function makeExercise(overrides: Partial<ConstructorParameters<typeof Exercise>[0]> = {}): Exercise {

    return new Exercise({
        id: "ex-001",
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "Write 'hello' in Danish",
        promptTranslation: null,
        answer: "hej",
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
        ...overrides,
    });
}

/**
 * Builds `exercisesPerItem` exercises for each of `itemCount` distinct vocabulary
 * items, e.g. makePoolWithDuplicates(5, 2) -> 10 exercises across 5 linked items.
 */
function makePoolWithDuplicates(itemCount: number, exercisesPerItem: number): Exercise[] {

    const pool: Exercise[] = [];

    for (let item = 0; item < itemCount; item++) {
        for (let copy = 0; copy < exercisesPerItem; copy++) {
            pool.push(makeExercise({ id: `ex-${item}-${copy}`, vocabularyItemId: `vocab-${item}` }));
        }
    }

    return pool;
}

describe("selectExercises", () => {

    it("returns exactly targetCount exercises when the pool is large enough", () => {

        const pool = makePoolWithDuplicates(10, 1);

        const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 4 });

        assert.lengthOf(selected, 4);
    });

    it("returns the whole pool when it is smaller than the target count", () => {

        const pool = makePoolWithDuplicates(3, 1);

        const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 10 });

        assert.lengthOf(selected, 3);
    });

    it("only returns exercises that belong to the pool", () => {

        const pool = makePoolWithDuplicates(8, 1);
        const poolIds = new Set(pool.map(e => e.id));

        const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 5 });

        for (const exercise of selected) assert.isTrue(poolIds.has(exercise.id), `${exercise.id} should come from the pool`);
    });

    describe("dedup by linked item", () => {

        it("does not pick two exercises for the same linked item when enough distinct items exist to fill the session", () => {

            // 6 distinct items, 2 exercises each — plenty to fill a 4-exercise session without repeats
            const pool = makePoolWithDuplicates(6, 2);

            const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 4 });
            const linkedItemIds = selected.map(e => e.vocabularyItemId);

            assert.lengthOf(new Set(linkedItemIds), linkedItemIds.length);
        });

        it("falls back to repeating a linked item's exercises when there are fewer distinct items than the target count", () => {

            // Only 2 distinct items, 3 exercises each — must repeat an item to reach 4
            const pool = makePoolWithDuplicates(2, 3);

            const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 4 });
            const linkedItemIds = selected.map(e => e.vocabularyItemId);

            assert.lengthOf(selected, 4);
            assert.isAtMost(new Set(linkedItemIds).size, 2);
            for (const id of linkedItemIds) assert.oneOf(id, ["vocab-0", "vocab-1"]);
        });

        it("never selects the very same exercise twice", () => {

            const pool = makePoolWithDuplicates(2, 3);

            const selected = selectExercises({ pool, masteryByItemId: new Map(), recentMisses: new Set(), targetCount: 6 });
            const exerciseIds = selected.map(e => e.id);

            assert.lengthOf(new Set(exerciseIds), exerciseIds.length);
        });
    });

    describe("integration with scoring", () => {

        it("excludes mastered exercises from the draw when enough weak ones remain to fill the session", () => {

            const mastered = makeExercise({ id: "ex-mastered", vocabularyItemId: "vocab-mastered" });
            const weakPool = makePoolWithDuplicates(5, 1).map((e, i) => makeExercise({ id: `ex-weak-${i}`, vocabularyItemId: `vocab-weak-${i}` }));

            const masteryByItemId = new Map<string, number>([["vocab-mastered", 0.95], ...weakPool.map((_, i): [string, number] => [`vocab-weak-${i}`, 0.1])]);

            const selected = selectExercises({ pool: [mastered, ...weakPool], masteryByItemId, recentMisses: new Set(), targetCount: 3 });

            assert.notInclude(selected.map(e => e.id), "ex-mastered");
        });
    });
});
