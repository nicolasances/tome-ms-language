import { assert } from "chai";
import { Request } from "express";
import { UserVocabularyProgress } from "../../../src/model/UserVocabularyProgress";
import { GetUserVocabularyProgress } from "../../../src/dlg/progress/GetUserVocabularyProgress";

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserVocabularyProgress>[0]> = {}): UserVocabularyProgress {
    return new UserVocabularyProgress({
        userId: "user-1",
        vocabularyItemId: "item-1",
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

describe("GetUserVocabularyProgress.parseRequest", () => {

    it("parses userId from route params", () => {
        const delegate = new GetUserVocabularyProgress({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("user-1"));
        assert.equal(parsed.userId, "user-1");
    });

    it("throws 400 when userId param is missing", () => {
        const delegate = new GetUserVocabularyProgress({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, body: {} } as unknown as Request), /400|userId/i);
    });
});

describe("GetUserVocabularyProgress.do", () => {

    it("returns all mastery records for the user", async () => {
        const progressDocs = [
            makeProgress({ vocabularyItemId: "item-1", masteryScore: 0.9 }).toBSON(),
            makeProgress({ vocabularyItemId: "item-2", masteryScore: 0.4 }).toBSON(),
            makeProgress({ userId: "user-2", vocabularyItemId: "item-3", masteryScore: 0.2 }).toBSON(),
        ];
        const config = makeMockConfig(progressDocs);
        const delegate = new GetUserVocabularyProgress({} as any, config);

        const result = await delegate.do({ userId: "user-1" });

        assert.equal(result.items.length, 2);
        const ids = result.items.map(i => i.vocabularyItemId);
        assert.include(ids, "item-1");
        assert.include(ids, "item-2");
        assert.notInclude(ids, "item-3");
    });

    it("returns an empty list when the user has no progress records", async () => {
        const config = makeMockConfig([]);
        const delegate = new GetUserVocabularyProgress({} as any, config);

        const result = await delegate.do({ userId: "user-1" });

        assert.deepEqual(result.items, []);
    });
});
