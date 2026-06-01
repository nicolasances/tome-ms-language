import { assert } from "chai";
import { ExerciseBank } from "../src/model/ExerciseBank";
import { ExerciseStore } from "../src/store/ExerciseStore";

function makeBank(overrides: Partial<ConstructorParameters<typeof ExerciseBank>[0]> = {}): ExerciseBank {

    return new ExerciseBank({
        id: "bank-001",
        moduleId: "mod-1",
        exerciseIds: ["ex-001", "ex-002"],
        generatedAt: new Date("2025-01-01"),
        totalGenerated: 2,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    const store = [...docs];

    return {
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
        get docs() { return store; },
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.insertBank", () => {

    it("inserts the bank and returns its id", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const bank = makeBank({ id: "bank-001" });

        const id = await store.insertBank(bank);

        assert.equal(id, "bank-001");
        assert.equal(col.docs.length, 1);
    });

    it("stores toBSON representation in the collection", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const bank = makeBank({ id: "bank-001", moduleId: "mod-42", exerciseIds: ["ex-001", "ex-002"] });

        await store.insertBank(bank);

        assert.equal(col.docs[0].id, "bank-001");
        assert.equal(col.docs[0].moduleId, "mod-42");
        assert.deepEqual(col.docs[0].exerciseIds, ["ex-001", "ex-002"]);
        assert.equal(col.docs[0].totalGenerated, 2);
    });

});
