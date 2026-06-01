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
        find: (filter: any) => ({
            toArray: async () => store.filter(doc => doc.moduleId === filter.moduleId),
        }),
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.listByModuleId", () => {

    it("returns all exercises for the given moduleId", async () => {

        const ex1 = makeExercise({ id: "ex-001", moduleId: "mod-1" });
        const ex2 = makeExercise({ id: "ex-002", moduleId: "mod-1" });
        const ex3 = makeExercise({ id: "ex-003", moduleId: "mod-2" });

        const col = makeMockCollection([ex1.toBSON(), ex2.toBSON(), ex3.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const results = await store.listByModuleId("mod-1");

        assert.equal(results.length, 2);
        assert.equal(results[0].id, "ex-001");
        assert.equal(results[1].id, "ex-002");
    });

    it("returns an empty array when no exercises exist for the module", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const results = await store.listByModuleId("mod-unknown");

        assert.deepEqual(results, []);
    });

});
