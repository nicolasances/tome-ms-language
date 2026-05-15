/**
 * Builds a MongoDB aggregation sort stage for difficulty-based sorting.
 *
 * Items without stats always sort to the end, regardless of direction.
 *
 * Strategy:
 *  - desc: negate failureRatio → sort ascending on sortKey.
 *          Items without stats get sortKey=1 which is > any value in [-1, 0].
 *  - asc:  use failureRatio directly → sort ascending on sortKey.
 *          Items without stats get sortKey=Number.MAX_VALUE which is > any value in [0, 1].
 */
export function buildDifficultySortStage(sortDir: "asc" | "desc"): object[] {
    if (sortDir === "desc") {
        return [
            {
                $addFields: {
                    sortKey: {
                        $cond: {
                            if: { $ifNull: ["$stats", false] },
                            then: { $multiply: ["$stats.failureRatio", -1] },
                            else: 1
                        }
                    }
                }
            },
            { $sort: { sortKey: 1 as const } }
        ];
    } else {
        return [
            {
                $addFields: {
                    sortKey: {
                        $cond: {
                            if: { $ifNull: ["$stats", false] },
                            then: "$stats.failureRatio",
                            else: Number.MAX_VALUE
                        }
                    }
                }
            },
            { $sort: { sortKey: 1 as const } }
        ];
    }
}
