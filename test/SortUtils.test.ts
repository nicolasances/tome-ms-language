import { assert } from "chai";
import { buildDifficultySortStage } from "../src/util/SortUtils";

describe("buildDifficultySortStage", () => {

    describe("sortDir=desc (hardest first)", () => {

        const stages = buildDifficultySortStage("desc") as any[];

        it("produces two stages", () => {
            assert.lengthOf(stages, 2);
        });

        it("first stage negates failureRatio for items with stats", () => {
            const { sortKey } = stages[0].$addFields;
            assert.deepEqual(sortKey.$cond.if, { $ifNull: ["$stats", false] });
            assert.deepEqual(sortKey.$cond.then, { $multiply: ["$stats.failureRatio", -1] });
        });

        it("first stage assigns sortKey=1 for items without stats (sinks them to end)", () => {
            assert.equal(stages[0].$addFields.sortKey.$cond.else, 1);
        });

        it("second stage sorts ascending on sortKey with _id tiebreaker", () => {
            assert.deepEqual(stages[1].$sort, { sortKey: 1, _id: 1 });
        });

        it("sentinel value 1 is greater than any negated failureRatio in [-1, 0]", () => {
            assert.isAbove(stages[0].$addFields.sortKey.$cond.else, 0);
        });
    });

    describe("sortDir=asc (easiest first)", () => {

        const stages = buildDifficultySortStage("asc") as any[];

        it("produces two stages", () => {
            assert.lengthOf(stages, 2);
        });

        it("first stage uses failureRatio directly for items with stats", () => {
            const { sortKey } = stages[0].$addFields;
            assert.deepEqual(sortKey.$cond.if, { $ifNull: ["$stats", false] });
            assert.equal(sortKey.$cond.then, "$stats.failureRatio");
        });

        it("first stage assigns Number.MAX_VALUE for items without stats (sinks them to end)", () => {
            assert.equal(stages[0].$addFields.sortKey.$cond.else, Number.MAX_VALUE);
        });

        it("second stage sorts ascending on sortKey with _id tiebreaker", () => {
            assert.deepEqual(stages[1].$sort, { sortKey: 1, _id: 1 });
        });

        it("sentinel Number.MAX_VALUE is greater than any failureRatio in [0, 1]", () => {
            assert.isAbove(stages[0].$addFields.sortKey.$cond.else, 1);
        });
    });
});
