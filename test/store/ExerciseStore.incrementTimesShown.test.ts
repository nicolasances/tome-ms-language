import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { ExerciseStore } from "../../src/store/ExerciseStore";

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
        timesShown: 0,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    const store = [...docs];

    return {
        updateOne: async (filter: any, update: any) => {
            const idx = store.findIndex(doc => doc.id === filter.id);
            if (idx === -1) return { matchedCount: 0 };

            if (update.$inc?.timesShown) store[idx].timesShown += update.$inc.timesShown;

            return { matchedCount: 1 };
        },
        get docs() { return store; },
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.incrementTimesShown", () => {

    it("increments timesShown by 1 and returns true", async () => {

        const ex = makeExercise({ timesShown: 3 });
        const col = makeMockCollection([ex.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const found = await store.incrementTimesShown("ex-001");

        assert.isTrue(found);
        assert.equal(col.docs[0].timesShown, 4);
    });

    it("returns false when the exercise does not exist", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const found = await store.incrementTimesShown("ex-unknown");

        assert.isFalse(found);
    });

});
