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
        find: (filter: any, _options?: any) => ({
            toArray: async () => {
                const moduleIds: string[] = filter.moduleId?.$in ?? [];
                return store.filter(doc => moduleIds.includes(doc.moduleId));
            },
        }),
        get docs() { return store; },
    };
}

function makeMockDb(exercisesCol: any) {
    return { collection: () => exercisesCol } as any;
}

describe("ExerciseStore.insertBatch", () => {

    it("inserts all exercises and returns their ids in inserted", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const ex1 = makeExercise({ id: "ex-001" });
        const ex2 = makeExercise({ id: "ex-002", prompt: "Write 'goodbye'" });

        const result = await store.insertBatch([ex1, ex2]);

        assert.deepEqual(result.inserted, ["ex-001", "ex-002"]);
        assert.equal(result.duplicatesSkipped, 0);
        assert.equal(col.docs.length, 2);
    });

    it("returns empty inserted and zero duplicatesSkipped for empty input", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.insertBatch([]);

        assert.deepEqual(result.inserted, []);
        assert.equal(result.duplicatesSkipped, 0);
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

    it("skips an exercise that already exists by (moduleId, type, prompt)", async () => {

        const existing = makeExercise({ id: "ex-existing" });
        const col = makeMockCollection([existing.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const duplicate = makeExercise({ id: "ex-new-id" });

        const result = await store.insertBatch([duplicate]);

        assert.deepEqual(result.inserted, []);
        assert.equal(result.duplicatesSkipped, 1);
        assert.equal(col.docs.length, 1);
    });

    it("inserts new exercises and skips duplicates in a mixed batch", async () => {

        const existing = makeExercise({ id: "ex-existing" });
        const col = makeMockCollection([existing.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const duplicate = makeExercise({ id: "ex-dup" });
        const newEx = makeExercise({ id: "ex-new", prompt: "Write 'goodbye'" });

        const result = await store.insertBatch([duplicate, newEx]);

        assert.deepEqual(result.inserted, ["ex-new"]);
        assert.equal(result.duplicatesSkipped, 1);
        assert.equal(col.docs.length, 2);
    });

    it("does not treat same prompt with different type as a duplicate", async () => {

        const existing = makeExercise({ id: "ex-001", type: "translation_active", vocabularyItemId: "vocab-1", grammarConceptId: null });
        const col = makeMockCollection([existing.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const differentType = makeExercise({ id: "ex-002", type: "fill_blank", vocabularyItemId: "vocab-1", grammarConceptId: null });

        const result = await store.insertBatch([differentType]);

        assert.deepEqual(result.inserted, ["ex-002"]);
        assert.equal(result.duplicatesSkipped, 0);
    });

    it("does not treat same prompt and type with different moduleId as a duplicate", async () => {

        const existing = makeExercise({ id: "ex-001", moduleId: "mod-1" });
        const col = makeMockCollection([existing.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const differentModule = makeExercise({ id: "ex-002", moduleId: "mod-2" });

        const result = await store.insertBatch([differentModule]);

        assert.deepEqual(result.inserted, ["ex-002"]);
        assert.equal(result.duplicatesSkipped, 0);
    });

});
