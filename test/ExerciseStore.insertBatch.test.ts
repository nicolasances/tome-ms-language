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
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
        insertMany: async (docs: any[]) => { store.push(...docs); return { insertedCount: docs.length }; },
        get docs() { return store; },
    };
}

function makeMockDb(exercisesCol: any) {
    return { collection: () => exercisesCol } as any;
}

describe("ExerciseStore.insertBatch", () => {

    it("inserts all exercises and returns their ids", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const ex1 = makeExercise({ id: "ex-001" });
        const ex2 = makeExercise({ id: "ex-002", prompt: "Write 'goodbye'" });

        const ids = await store.insertBatch([ex1, ex2]);

        assert.deepEqual(ids, ["ex-001", "ex-002"]);
        assert.equal(col.docs.length, 2);
    });

    it("returns empty array when given empty input", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const ids = await store.insertBatch([]);

        assert.deepEqual(ids, []);
        assert.equal(col.docs.length, 0);
    });

    it("stores toBSON representation in the collection", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const ex = makeExercise({ id: "ex-001" });

        await store.insertBatch([ex]);

        assert.equal(col.docs[0].id, "ex-001");
        assert.equal(col.docs[0].type, "translation_active");
        assert.equal(col.docs[0].answer, "hej");
        assert.equal(col.docs[0].timesShown, 0);
    });

});
