import { assert } from "chai";
import { Request } from "express";
import { UserGrammarConceptProgress } from "../src/model/UserGrammarConceptProgress";
import { GetUserGrammarProgress } from "../src/dlg/progress/GetUserGrammarProgress";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserGrammarConceptProgress>[0]> = {}): UserGrammarConceptProgress {
    return new UserGrammarConceptProgress({
        userId: "user-1",
        grammarConceptId: "gc-inversion",
        masteryScore: 0.5,
        lastReviewed: "2026-05-01T09:00:00.000Z",
        exerciseHistory: [],
        ...overrides,
    });
}

function makeReq(userId: string): Request {
    return { params: { userId }, body: {} } as unknown as Request;
}

function makeMockConfig(progressDocs: any[]) {
    const progressCol = {
        find: (filter: any) => ({
            toArray: async () => progressDocs.filter(d => d.userId === filter.userId),
        }),
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => progressCol }),
    } as any;
}

describe("GetUserGrammarProgress.parseRequest", () => {

    it("parses userId from route params", () => {
        const delegate = new GetUserGrammarProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1"));
        assert.equal(parsed.userId, "user-1");
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new GetUserGrammarProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, body: {} } as unknown as Request), /400|userId/i);
    });
});

describe("GetUserGrammarProgress.do", () => {

    it("returns all mastery records for the user", async () => {
        const progressDocs = [
            makeProgress({ grammarConceptId: "gc-inversion", masteryScore: 0.9 }).toBSON(),
            makeProgress({ grammarConceptId: "gc-modal-verbs", masteryScore: 0.4 }).toBSON(),
            makeProgress({ userId: "user-2", grammarConceptId: "gc-passive", masteryScore: 0.2 }).toBSON(),
        ];
        const config = makeMockConfig(progressDocs);
        const delegate = new GetUserGrammarProgress({} as any, config);

        const result = await delegate.do({ userId: "user-1" });

        assert.equal(result.items.length, 2);
        const ids = result.items.map(i => i.grammarConceptId);
        assert.include(ids, "gc-inversion");
        assert.include(ids, "gc-modal-verbs");
        assert.notInclude(ids, "gc-passive");
    });

    it("returns an empty list when the user has no progress records", async () => {
        const config = makeMockConfig([]);
        const delegate = new GetUserGrammarProgress({} as any, config);

        const result = await delegate.do({ userId: "user-1" });

        assert.deepEqual(result.items, []);
    });
});
