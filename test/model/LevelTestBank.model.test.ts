import { strict as assert } from "assert";
import { ObjectId } from "mongodb";
import { LevelTestBank } from "../../src/model/LevelTestBank";

describe("LevelTestBank.fromBSON", () => {

    it("round-trips all fields through toBSON / fromBSON", () => {

        const oid = new ObjectId();

        const bank = new LevelTestBank({
            id: oid.toString(),
            cefrLevel: "A1",
            exerciseIds: ["ex-1", "ex-2"],
            generatedAt: "2026-06-12T10:00:00.000Z",
            totalGenerated: 2,
        });

        const bson = { _id: oid, ...bank.toBSON() };
        const result = LevelTestBank.fromBSON(bson as any);

        assert.equal(result.id, oid.toString());
        assert.equal(result.cefrLevel, "A1");
        assert.deepEqual(result.exerciseIds, ["ex-1", "ex-2"]);
        assert.equal(result.generatedAt, "2026-06-12T10:00:00.000Z");
        assert.equal(result.totalGenerated, 2);
    });

    it("defaults exerciseIds to an empty array and totalGenerated to 0 when missing", () => {

        const bank = new LevelTestBank({
            id: "bank-1",
            cefrLevel: "B1",
            generatedAt: "2026-06-12T10:00:00.000Z",
        } as any);

        assert.deepEqual(bank.exerciseIds, []);
        assert.equal(bank.totalGenerated, 0);
    });
});
