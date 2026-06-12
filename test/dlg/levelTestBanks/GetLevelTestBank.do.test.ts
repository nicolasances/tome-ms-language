import { assert } from "chai";
import { GetLevelTestBank } from "../../../src/dlg/levelTestBanks/GetLevelTestBank";

function makeMockConfig(existingBank: any) {

    const banks: any[] = existingBank ? [existingBank] : [];

    const collections: Record<string, any> = {
        levelTestBanks: {
            findOne: async (filter: any) => banks.find(b => b.cefrLevel === filter.cefrLevel) ?? null,
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

describe("GetLevelTestBank.do", () => {

    it("returns the bank for the level when it exists", async () => {

        const config = makeMockConfig({ id: "bank-1", cefrLevel: "A1", exerciseIds: ["ex-1", "ex-2"], generatedAt: "2026-06-12T10:00:00.000Z", totalGenerated: 2 });
        const delegate = new GetLevelTestBank({} as any, config);

        const result = await delegate.do({ cefrLevel: "A1" });

        assert.equal(result.bank.cefrLevel, "A1");
        assert.deepEqual(result.bank.exerciseIds, ["ex-1", "ex-2"]);
        assert.equal(result.bank.totalGenerated, 2);
    });

    it("throws 404 when no bank exists for the level", async () => {

        const config = makeMockConfig(null);
        const delegate = new GetLevelTestBank({} as any, config);

        try {
            await delegate.do({ cefrLevel: "C2" });
            assert.fail("Expected 404");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});
