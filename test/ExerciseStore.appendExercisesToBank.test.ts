import { assert } from "chai";
import { ExerciseBank } from "../src/model/ExerciseBank";
import { ExerciseStore } from "../src/store/ExerciseStore";

function makeBank(overrides: Partial<ConstructorParameters<typeof ExerciseBank>[0]> = {}): ExerciseBank {

    return new ExerciseBank({
        id: "bank-001",
        moduleId: "mod-1",
        exerciseIds: ["ex-001"],
        generatedAt: new Date("2025-01-01"),
        totalGenerated: 1,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    const store = [...docs];

    return {
        findOne: async (filter: any) => store.find(doc => doc.moduleId === filter.moduleId) ?? null,
        insertOne: async (doc: any) => { store.push(doc); return { insertedId: "mock" }; },
        updateOne: async (filter: any, update: any) => {
            const idx = store.findIndex(doc => doc.moduleId === filter.moduleId);
            if (idx === -1) return { matchedCount: 0 };

            const doc = store[idx];

            if (update.$push?.exerciseIds?.$each) doc.exerciseIds.push(...update.$push.exerciseIds.$each);
            if (update.$inc?.totalGenerated) doc.totalGenerated += update.$inc.totalGenerated;
            if (update.$set?.generatedAt) doc.generatedAt = update.$set.generatedAt;

            return { matchedCount: 1 };
        },
        get docs() { return store; },
    };
}

function makeMockDb(col: any) {
    return { collection: () => col } as any;
}

describe("ExerciseStore.appendExercisesToBank", () => {

    it("appends exercise ids, increments totalGenerated, and updates generatedAt", async () => {

        const bank = makeBank({ exerciseIds: ["ex-001"], totalGenerated: 1 });
        const col = makeMockCollection([bank.toBSON()]);
        const store = new ExerciseStore(makeMockDb(col));

        const newDate = new Date("2025-06-01");

        await store.appendExercisesToBank("mod-1", ["ex-002", "ex-003"], newDate);

        const updated = col.docs[0];

        assert.deepEqual(updated.exerciseIds, ["ex-001", "ex-002", "ex-003"]);
        assert.equal(updated.totalGenerated, 3);
        assert.deepEqual(updated.generatedAt, newDate);
    });

});
