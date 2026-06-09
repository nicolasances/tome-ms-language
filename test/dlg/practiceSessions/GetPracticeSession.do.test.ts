import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetPracticeSession } from "../../../src/dlg/practiceSessions/GetPracticeSession";

function makeSessionBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

function makeMockConfig(sessionDoc: any | null) {

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({
            collection: (_name: string) => ({
                findOne: async (_filter: any) => sessionDoc,
            }),
        }),
    } as any;
}

describe("GetPracticeSession.do", () => {

    it("returns the session state when found and owned by the user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeSessionBSON(oid));
        const delegate = new GetPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(result.sessionId, oid.toString());
        assert.equal(result.userId, "user-1");
        assert.equal(result.moduleId, "mod-1");
        assert.deepEqual(result.exerciseIds, ["ex-1", "ex-2"]);
        assert.equal(result.currentPosition, 0);
        assert.deepEqual(result.retryQueue, []);
        assert.isNull(result.completedAt);
    });

    it("throws 404 when the session does not exist", async () => {

        const config = makeMockConfig(null);
        const delegate = new GetPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: new ObjectId().toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 404 error");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 403 when the session belongs to a different user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeSessionBSON(oid, { userId: "user-2" }));
        const delegate = new GetPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 403 error");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });
});
