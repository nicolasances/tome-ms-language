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
        findOne: async (filter: any) => store.find(doc => doc.moduleId === filter.moduleId) ?? null,
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.findBankByModuleId", () => {

    it("returns the bank when it exists for the given moduleId", async () => {

        const bank = makeBank({ moduleId: "mod-1" });
        const col = makeMockCollection([bank.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findBankByModuleId("mod-1");

        assert.isNotNull(result);
        assert.equal(result!.id, "bank-001");
        assert.equal(result!.moduleId, "mod-1");
        assert.deepEqual(result!.exerciseIds, ["ex-001", "ex-002"]);
    });

    it("returns null when no bank exists for the given moduleId", async () => {

        const col = makeMockCollection();
        const store = new ExerciseStore(makeMockDb(col));

        const result = await store.findBankByModuleId("mod-unknown");

        assert.isNull(result);
    });

});
