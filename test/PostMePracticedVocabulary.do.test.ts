import { assert } from "chai";
import { User } from "../src/model/User";
import { UserModuleProgress } from "../src/model/UserModuleProgress";
import { PostMePracticedVocabulary } from "../src/dlg/user/PostMePracticedVocabulary";

const userContext = { email: "alice@example.com", userId: "u1", authProvider: "test" };

function makeUser() {
    return new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" });
}

function makeProgress(overrides: Partial<ConstructorParameters<typeof UserModuleProgress>[0]> = {}): UserModuleProgress {
    return new UserModuleProgress({
        userId: "uuid-001", moduleId: "mod-1", status: "in_progress",
        startedAt: "2026-06-01T09:00:00.000Z", completedAt: null, testAttempts: [],
        ...overrides,
    });
}

function makeMockConfig(userDocs: any[], progressDocs: any[]) {
    const userCol = {
        findOne: async (filter: any) => userDocs.find(d => d.email === filter.email) ?? null,
    };
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId) ?? null,
        updateOne: async (filter: any, update: any) => {
            const doc = progressDocs.find(d => d.userId === filter.userId && d.moduleId === filter.moduleId);
            if (!doc) return { matchedCount: 0 };
            doc.vocabularyItemsPracticed = doc.vocabularyItemsPracticed ?? [];
            for (const id of update.$addToSet.vocabularyItemsPracticed.$each) {
                if (!doc.vocabularyItemsPracticed.includes(id)) doc.vocabularyItemsPracticed.push(id);
            }
            return { matchedCount: 1 };
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({
            collection: (name: string) => name === "users" ? userCol : progressCol,
        }),
    } as any;
}

describe("PostMePracticedVocabulary.do", () => {

    it("appends the vocabulary ids to the user's module progress and returns the updated set", async () => {
        const progressDocs = [makeProgress({ vocabularyItemsPracticed: ["v-1"] }).toBSON()];
        const config = makeMockConfig([makeUser().toBSON()], progressDocs);
        const delegate = new PostMePracticedVocabulary({} as any, config);

        const result = await delegate.do({ moduleId: "mod-1", vocabularyItemIds: ["v-1", "v-2"] }, userContext);

        assert.equal(result.moduleId, "mod-1");
        assert.deepEqual(result.vocabularyItemsPracticed, ["v-1", "v-2"]);
    });

    it("throws 404 when the user profile is not found", async () => {
        const config = makeMockConfig([], []);
        const delegate = new PostMePracticedVocabulary({} as any, config);

        try {
            await delegate.do({ moduleId: "mod-1", vocabularyItemIds: ["v-1"] }, userContext);
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 404 when no progress record exists for the module", async () => {
        const config = makeMockConfig([makeUser().toBSON()], []);
        const delegate = new PostMePracticedVocabulary({} as any, config);

        try {
            await delegate.do({ moduleId: "mod-1", vocabularyItemIds: ["v-1"] }, userContext);
            assert.fail("Expected error");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });
});
