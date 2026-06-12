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
        findOne: async (filter: any) => docs.find(d => d.cefrLevel === filter.cefrLevel) ?? null,
        insertOne: async (doc: any) => { docs.push(doc); return { insertedId: "mock" }; },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("LevelTestBankStore.insertOne", () => {

    it("inserts a new bank and returns status created", async () => {

        const store = new LevelTestBankStore(makeMockDb(makeMockCollection()));

        const result = await store.insertOne(makeBank());

        assert.equal(result.status, "created");
        assert.equal(result.bank.cefrLevel, "A1");
    });

    it("returns duplicate_level when a bank already exists for the level", async () => {

        const docs = [makeBank().toBSON()];
        const store = new LevelTestBankStore(makeMockDb(makeMockCollection(docs)));

        const result = await store.insertOne(makeBank({ id: "bank-2" }));

        assert.equal(result.status, "duplicate_level");
    });
});
