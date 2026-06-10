import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { ExerciseStore } from "../../src/store/ExerciseStore";

function makeExercise(id: string, overrides: Partial<ConstructorParameters<typeof Exercise>[0]> = {}): Exercise {

    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    return {
        find: (filter: any) => ({
            toArray: async () => {
                const ids: string[] = filter?.id?.$in ?? [];
                return docs.filter(doc => ids.includes(doc.id));
            },
        }),
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.findByIds", () => {

    it("returns all matching exercises given a list of ids", async () => {

        const ex1 = makeExercise("ex-1");
        const ex2 = makeExercise("ex-2");
        const ex3 = makeExercise("ex-3");
        const col = makeMockCollection([ex1.toBSON(), ex2.toBSON(), ex3.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findByIds(["ex-1", "ex-3"]);

        assert.lengthOf(result, 2);
        assert.isTrue(result.some(e => e.id === "ex-1"));
        assert.isTrue(result.some(e => e.id === "ex-3"));
    });

    it("returns an empty array when none of the ids match", async () => {

        const ex1 = makeExercise("ex-1");
        const col = makeMockCollection([ex1.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findByIds(["ex-unknown"]);

        assert.deepEqual(result, []);
    });

    it("returns an empty array when given an empty ids list", async () => {

        const ex1 = makeExercise("ex-1");
        const col = makeMockCollection([ex1.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findByIds([]);

        assert.deepEqual(result, []);
    });

});
