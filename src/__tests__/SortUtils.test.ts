import { buildDifficultySortStage } from "../util/SortUtils";

describe("buildDifficultySortStage", () => {

    describe("sortDir=desc (hardest first)", () => {

        const stages = buildDifficultySortStage("desc") as any[];

        it("produces two stages", () => {
            expect(stages).toHaveLength(2);
        });

        it("first stage negates failureRatio for items with stats", () => {
            const addFields = stages[0].$addFields;
            expect(addFields.sortKey.$cond.if).toEqual({ $ifNull: ["$stats", false] });
            expect(addFields.sortKey.$cond.then).toEqual({ $multiply: ["$stats.failureRatio", -1] });
        });

        it("first stage assigns sortKey=1 for items without stats (sinks them to end)", () => {
            const addFields = stages[0].$addFields;
            expect(addFields.sortKey.$cond.else).toBe(1);
        });

        it("second stage sorts ascending on sortKey", () => {
            expect(stages[1].$sort).toEqual({ sortKey: 1 });
        });

        it("sentinel value 1 is greater than any negated failureRatio in [-1, 0]", () => {
            // failureRatio is in [0,1], so negated it's in [-1,0]. 1 > 0 => no-stats items last.
            const sentinel = stages[0].$addFields.sortKey.$cond.else;
            expect(sentinel).toBeGreaterThan(0);
        });
    });

    describe("sortDir=asc (easiest first)", () => {

        const stages = buildDifficultySortStage("asc") as any[];

        it("produces two stages", () => {
            expect(stages).toHaveLength(2);
        });

        it("first stage uses failureRatio directly for items with stats", () => {
            const addFields = stages[0].$addFields;
            expect(addFields.sortKey.$cond.if).toEqual({ $ifNull: ["$stats", false] });
            expect(addFields.sortKey.$cond.then).toBe("$stats.failureRatio");
        });

        it("first stage assigns Number.MAX_VALUE for items without stats (sinks them to end)", () => {
            const addFields = stages[0].$addFields;
            expect(addFields.sortKey.$cond.else).toBe(Number.MAX_VALUE);
        });

        it("second stage sorts ascending on sortKey", () => {
            expect(stages[1].$sort).toEqual({ sortKey: 1 });
        });

        it("sentinel Number.MAX_VALUE is greater than any failureRatio in [0, 1]", () => {
            const sentinel = stages[0].$addFields.sortKey.$cond.else;
            expect(sentinel).toBeGreaterThan(1);
        });
    });
});
