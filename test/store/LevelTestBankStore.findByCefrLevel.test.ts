import { assert } from "chai";
import { LevelTestBank } from "../../src/model/LevelTestBank";
import { LevelTestBankStore } from "../../src/store/LevelTestBankStore";

function makeMockCollection(docs: any[] = []) {

    return {
        findOne: async (filter: any) => docs.find(d => d.cefrLevel === filter.cefrLevel) ?? null,
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("LevelTestBankStore.findByCefrLevel", () => {

    it("returns the bank for a level when it exists", async () => {

        const bank = new LevelTestBank({ id: "bank-1", cefrLevel: "B1", exerciseIds: ["ex-1", "ex-2"], generatedAt: "2026-06-12T10:00:00.000Z", totalGenerated: 2 });
        const store = new LevelTestBankStore(makeMockDb(makeMockCollection([bank.toBSON()])));

        const result = await store.findByCefrLevel("B1");

        assert.isNotNull(result);
        assert.equal(result!.cefrLevel, "B1");
        assert.deepEqual(result!.exerciseIds, ["ex-1", "ex-2"]);
    });

    it("returns null when no bank exists for the level", async () => {

        const store = new LevelTestBankStore(makeMockDb(makeMockCollection([])));

        const result = await store.findByCefrLevel("C2");

        assert.isNull(result);
    });
});
