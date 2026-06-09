import { assert } from "chai";
import { Request } from "express";
import { UserGrammarConceptProgress } from "../../../src/model/UserGrammarConceptProgress";
import { GetUserGrammarProgressItem } from "../../../src/dlg/progress/GetUserGrammarProgressItem";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserGrammarConceptProgress>[0]> = {}): UserGrammarConceptProgress {
    return new UserGrammarConceptProgress({
        userId: "user-1",
        grammarConceptId: "gc-inversion",
        masteryScore: 0.62,
        lastReviewed: "2026-05-01T09:00:00.000Z",
        exerciseHistory: [],
        ...overrides,
    });
}

function makeReq(userId: string, grammarConceptId: string): Request {
    return { params: { userId, grammarConceptId }, body: {} } as unknown as Request;
}

function makeMockConfig(progressDocs: any[]) {
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.grammarConceptId === filter.grammarConceptId) ?? null,
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => progressCol }),
    } as any;
}

describe("GetUserGrammarProgressItem.parseRequest", () => {

    it("parses userId and grammarConceptId from route params", () => {
        const delegate = new GetUserGrammarProgressItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", "gc-inversion"));
        assert.equal(parsed.userId, "user-1");
        assert.equal(parsed.grammarConceptId, "gc-inversion");
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new GetUserGrammarProgressItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: { grammarConceptId: "gc-inversion" }, body: {} } as unknown as Request), /400|userId/i);
    });

    it("throws 400 when grammarConceptId param is missing", () => {
        const delegate = new GetUserGrammarProgressItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: { userId: "user-1" }, body: {} } as unknown as Request), /400|grammarConceptId/i);
    });
});

describe("GetUserGrammarProgressItem.do", () => {

    it("returns the mastery record for the given user and concept", async () => {
        const config = makeMockConfig([makeProgress({ masteryScore: 0.62 }).toBSON()]);
        const delegate = new GetUserGrammarProgressItem({} as any, config);

        const result = await delegate.do({ userId: "user-1", grammarConceptId: "gc-inversion" });

        assert.equal(result.userId, "user-1");
        assert.equal(result.grammarConceptId, "gc-inversion");
        assert.equal(result.masteryScore, 0.62);
    });

    it("throws 404 when no record exists for the user+concept pair", async () => {
        const config = makeMockConfig([]);
        const delegate = new GetUserGrammarProgressItem({} as any, config);

        try {
            await delegate.do({ userId: "user-1", grammarConceptId: "gc-inversion" });
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});
