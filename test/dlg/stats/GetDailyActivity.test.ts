import { assert } from "chai";
import { Request } from "express";
import { GetDailyActivity } from "../../../src/dlg/stats/GetDailyActivity";

const userContext = { email: "u1@u1.com", authProvider: "test", userId: "SHOULD-NOT-BE-USED" };

// ---------------------------------------------------------------------------
// Mock collection factory — supports find().toArray() per collection name
// ---------------------------------------------------------------------------

function makeMockDb(practiceSessionDocs: any[], moduleTestDocs: any[], levelTestDocs: any[], user: {userId: string, email: string} = {userId: "u1", email: "u1@u1.com"}) {
    function makeCol(docs: any[], timestampField: string, passedFilter?: boolean) {
        return {
            find: (filter: any) => ({
                toArray: async () => {
                    return docs.filter(d => {
                        if (d.userId !== filter.userId) return false;
                        if (passedFilter !== undefined && d.passed !== passedFilter) return false;
                        const ts = d[timestampField];
                        if (!ts) return false;
                        if (filter[timestampField]?.$gte && ts < filter[timestampField].$gte) return false;
                        if (filter[timestampField]?.$lte && ts > filter[timestampField].$lte) return false;
                        return true;
                    });
                },
            }),
        };
    }

    function makeUserCol(user: {email: string, userId: string}) {
        return {
            findOne: async (filter: any) => {
                if (filter.email === user.email) {
                    return { id: user.userId, email: user.email };
                }
                return null;
            }
        }
    }

    return {
        collection: (name: string) => {
            if (name === "practiceSessions") return makeCol(practiceSessionDocs, "completedAt");
            if (name === "moduleTestAttempts") return makeCol(moduleTestDocs, "takenAt", true);
            if (name === "levelTestAttempts") return makeCol(levelTestDocs, "takenAt", true);
            if (name === "users") return makeUserCol(user);
            throw new Error(`Unknown collection: ${name}`);
        },
    } as any;
}

function makeMockConfig(db: any) {
    return {
        getDBName: () => "test",
        getMongoDb: async () => db,
    } as any;
}

function makeReq(from?: string): Request {
    return { params: {}, query: from ? { from } : {}, body: {} } as unknown as Request;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetDailyActivity.parseRequest", () => {

    it("captures the from query param when provided", () => {
        const delegate = new GetDailyActivity({} as any, makeMockConfig(makeMockDb([], [], [])));
        const result = delegate.parseRequest(makeReq("20260621"));
        assert.equal(result.from, "20260621");
    });

    it("returns undefined from when param is omitted", () => {
        const delegate = new GetDailyActivity({} as any, makeMockConfig(makeMockDb([], [], [])));
        const result = delegate.parseRequest(makeReq());
        assert.isUndefined(result.from);
    });
});

describe("GetDailyActivity.do", () => {

    it("returns a dense 7-day array with correct counts from all three stores", async () => {
        const practiceSessionDocs = [
            { userId: "u1", completedAt: "2026-06-21T10:00:00.000Z" },
            { userId: "u1", completedAt: "2026-06-21T14:00:00.000Z" },
            { userId: "u1", completedAt: "2026-06-23T09:00:00.000Z" },
        ];
        const moduleTestDocs = [
            { userId: "u1", passed: true, takenAt: "2026-06-23T11:00:00.000Z" },
        ];
        const levelTestDocs = [
            { userId: "u1", passed: true, takenAt: "2026-06-27T15:00:00.000Z" },
        ];

        const db = makeMockDb(practiceSessionDocs, moduleTestDocs, levelTestDocs);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        const result = await delegate.do({ from: "20260621" }, userContext);

        assert.equal(result.from, "20260621");
        assert.equal(result.to, "20260627");
        assert.equal(result.days.length, 7);

        const day21 = result.days.find(d => d.date === "20260621")!;
        assert.equal(day21.practiceSessions, 2);
        assert.equal(day21.successfulModuleTests, 0);
        assert.equal(day21.successfulLevelTests, 0);

        const day23 = result.days.find(d => d.date === "20260623")!;
        assert.equal(day23.practiceSessions, 1);
        assert.equal(day23.successfulModuleTests, 1);
        assert.equal(day23.successfulLevelTests, 0);

        const day27 = result.days.find(d => d.date === "20260627")!;
        assert.equal(day27.practiceSessions, 0);
        assert.equal(day27.successfulModuleTests, 0);
        assert.equal(day27.successfulLevelTests, 1);
    });

    it("returns empty days when no data is available for the user", async () => {
        const practiceSessionDocs = [
            { userId: "u2", completedAt: "2026-06-21T10:00:00.000Z" },
            { userId: "u2", completedAt: "2026-06-21T14:00:00.000Z" },
            { userId: "u2", completedAt: "2026-06-23T09:00:00.000Z" },
        ];
        const moduleTestDocs = [
            { userId: "u2", passed: true, takenAt: "2026-06-23T11:00:00.000Z" },
        ];
        const levelTestDocs = [
            { userId: "u2", passed: true, takenAt: "2026-06-27T15:00:00.000Z" },
        ];

        const db = makeMockDb(practiceSessionDocs, moduleTestDocs, levelTestDocs);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        const result = await delegate.do({ from: "20260621" }, userContext);
        
        assert.equal(result.days.length, 7);
        for (const day of result.days) {
            assert.equal(day.practiceSessions, 0);
            assert.equal(day.successfulModuleTests, 0);
            assert.equal(day.successfulLevelTests, 0);
        }
    });

    it("fills empty days with zero counts so the array is always dense", async () => {
        const db = makeMockDb([], [], []);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        const result = await delegate.do({ from: "20260621" }, userContext);

        assert.equal(result.days.length, 7);
        for (const day of result.days) {
            assert.equal(day.practiceSessions, 0);
            assert.equal(day.successfulModuleTests, 0);
            assert.equal(day.successfulLevelTests, 0);
        }
    });

    it("orders days oldest-first", async () => {
        const db = makeMockDb([], [], []);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        const result = await delegate.do({ from: "20260621" }, userContext);

        for (let i = 1; i < result.days.length; i++) {
            assert.isTrue(result.days[i].date > result.days[i - 1].date);
        }
    });

    it("defaults from to today-6 when omitted, returning a 7-day window ending today", async () => {
        const db = makeMockDb([], [], []);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        const result = await delegate.do({}, userContext);

        assert.equal(result.days.length, 7);
        // to should be after from by exactly 6 days
        assert.isTrue(result.to > result.from);
        assert.equal(result.days[0].date, result.from);
        assert.equal(result.days[6].date, result.to);
    });

    it("throws a 400 ValidationError when from is not a valid YYYYMMDD date", async () => {
        const db = makeMockDb([], [], []);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        try {
            await delegate.do({ from: "not-a-date" }, userContext);
            assert.fail("Expected a ValidationError");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws a 400 ValidationError when from has wrong format (8 digits but invalid date)", async () => {
        const db = makeMockDb([], [], []);
        const delegate = new GetDailyActivity({} as any, makeMockConfig(db));

        try {
            await delegate.do({ from: "20261399" }, userContext);
            assert.fail("Expected a ValidationError");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });
});
