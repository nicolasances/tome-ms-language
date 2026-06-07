import { assert } from "chai";
import { Request } from "express";
import { UserVocabularyProgress } from "../src/model/UserVocabularyProgress";
import { GetUserVocabularyProgressItem } from "../src/dlg/progress/GetUserVocabularyProgressItem";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserVocabularyProgress>[0]> = {}): UserVocabularyProgress {
    return new UserVocabularyProgress({
        userId: "user-1",
        vocabularyItemId: "item-1",
        masteryScore: 0.62,
        lastReviewed: "2026-05-01T09:00:00.000Z",
        exerciseHistory: [],
        ...overrides,
    });
}

function makeReq(userId: string, vocabularyItemId: string): Request {
    return { params: { userId, vocabularyItemId }, body: {} } as unknown as Request;
}

function makeMockConfig(progressDocs: any[]) {
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.vocabularyItemId === filter.vocabularyItemId) ?? null,
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => progressCol }),
    } as any;
}

describe("GetUserVocabularyProgressItem.parseRequest", () => {

    it("parses userId and vocabularyItemId from route params", () => {
        const delegate = new GetUserVocabularyProgressItem({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1", "item-1"));
        assert.equal(parsed.userId, "user-1");
        assert.equal(parsed.vocabularyItemId, "item-1");
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new GetUserVocabularyProgressItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: { vocabularyItemId: "item-1" }, body: {} } as unknown as Request), /400|userId/i);
    });

    it("throws 400 when vocabularyItemId param is missing", () => {
        const delegate = new GetUserVocabularyProgressItem({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: { userId: "user-1" }, body: {} } as unknown as Request), /400|vocabularyItemId/i);
    });
});

describe("GetUserVocabularyProgressItem.do", () => {

    it("returns the mastery record for the given user and item", async () => {
        const config = makeMockConfig([makeProgress({ masteryScore: 0.62 }).toBSON()]);
        const delegate = new GetUserVocabularyProgressItem({} as any, config);

        const result = await delegate.do({ userId: "user-1", vocabularyItemId: "item-1" });

        assert.equal(result.userId, "user-1");
        assert.equal(result.vocabularyItemId, "item-1");
        assert.equal(result.masteryScore, 0.62);
    });

    it("throws 404 when no record exists for the user+item pair", async () => {
        const config = makeMockConfig([]);
        const delegate = new GetUserVocabularyProgressItem({} as any, config);

        try {
            await delegate.do({ userId: "user-1", vocabularyItemId: "item-1" });
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});
