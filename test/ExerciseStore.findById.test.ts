import { assert } from "chai";
import { Exercise } from "../src/model/Exercise";
import { ExerciseStore } from "../src/store/ExerciseStore";

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

function makeMockCollection(docs: any[] = []) {

    const store = [...docs];

    return {
        findOne: async (filter: any) => store.find(doc => doc.id === filter.id) ?? null,
    };
}

function makeMockDb(exercisesCol: any) {
    return { collection: () => exercisesCol } as any;
}

describe("ExerciseStore.findById", () => {

    it("returns the exercise when it exists", async () => {

        const ex = makeExercise({ id: "ex-001" });
        const col = makeMockCollection([ex.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findById("ex-001");

        assert.isNotNull(result);
        assert.equal(result!.id, "ex-001");
        assert.equal(result!.type, "translation_active");
        assert.equal(result!.answer, "hej");
    });

    it("returns null when the exercise does not exist", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findById("ex-unknown");

        assert.isNull(result);
    });

});
