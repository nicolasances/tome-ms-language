import { assert } from "chai";
import { LevelTestBank } from "../../src/model/LevelTestBank";
import { LevelTestBankStore } from "../../src/store/LevelTestBankStore";

function makeBank(overrides: Partial<ConstructorParameters<typeof LevelTestBank>[0]> = {}): LevelTestBank {

    return new LevelTestBank({
        id: "bank-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1"],
        generatedAt: "2026-06-12T10:00:00.000Z",
        totalGenerated: 1,
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    return {
        findOneAndUpdate: async (filter: any, update: any, _options: any) => {

            const doc = docs.find(d => d.cefrLevel === filter.cefrLevel);

            if (!doc) return null;

            doc.exerciseIds = [...(doc.exerciseIds ?? []), ...update.$push.exerciseIds.$each];
            doc.totalGenerated = (doc.totalGenerated ?? 0) + update.$inc.totalGenerated;
            doc.generatedAt = update.$set.generatedAt;

            return doc;
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("LevelTestBankStore.appendExerciseIds", () => {

    it("appends ids, increments totalGenerated, updates generatedAt and returns the updated bank", async () => {

        const docs = [makeBank().toBSON()];
        const store = new LevelTestBankStore(makeMockDb(makeMockCollection(docs)));

        const result = await store.appendExerciseIds("A1", ["ex-2", "ex-3"], "2026-06-13T10:00:00.000Z");

        assert.isNotNull(result);
        assert.deepEqual(result!.exerciseIds, ["ex-1", "ex-2", "ex-3"]);
        assert.equal(result!.totalGenerated, 3);
        assert.equal(result!.generatedAt, "2026-06-13T10:00:00.000Z");
    });

    it("returns null when no bank exists for the level", async () => {

        const store = new LevelTestBankStore(makeMockDb(makeMockCollection([])));

        const result = await store.appendExerciseIds("C1", ["ex-2"], "2026-06-13T10:00:00.000Z");

        assert.isNull(result);
    });
});
