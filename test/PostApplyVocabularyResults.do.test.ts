import { assert } from "chai";
import { ExerciseResult } from "../src/model/ExerciseResult";
import { UserVocabularyProgress } from "../src/model/UserVocabularyProgress";
import { PostApplyVocabularyResults } from "../src/dlg/progress/PostApplyVocabularyResults";
import { applyCorrect, applyIncorrect } from "../src/util/SrsAlgorithm";

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

function makeResult(overrides: Partial<ConstructorParameters<typeof ExerciseResult>[0]> = {}): ExerciseResult {
    return new ExerciseResult({
        exerciseId: "ex-1",
        type: "multiple_choice",
        isCorrect: true,
        userAnswer: "hund",
        correctAnswer: "hund",
        timestamp: "2026-06-01T10:00:00.000Z",
        moduleId: "mod-1",
        ...overrides,
    });
}

function makeMockConfig(progressDocs: any[]) {
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.vocabularyItemId === filter.vocabularyItemId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = progressDocs.findIndex(d => d.userId === doc.userId && d.vocabularyItemId === doc.vocabularyItemId);
            if (idx >= 0) progressDocs[idx] = doc; else progressDocs.push(doc);
            return {};
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => progressCol }),
    } as any;
}

function makeRequest(overrides: { userId?: string; results?: { vocabularyItemId: string; result: ExerciseResult }[] } = {}) {
    return {
        userId: overrides.userId ?? "user-1",
        results: overrides.results ?? [
            { vocabularyItemId: "item-1", result: makeResult() },
        ],
    };
}

describe("PostApplyVocabularyResults.do", () => {

    it("recomputes the mastery score for an existing record on a correct answer", async () => {
        const progressDocs = [makeProgress({ masteryScore: 0.5 }).toBSON()];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyVocabularyResults({} as any, config);

        const result = await delegate.do(makeRequest());

        assert.approximately(progressDocs[0].masteryScore, applyCorrect(0.5), 1e-9);
        assert.equal(result.updated.length, 1);
        assert.equal(result.updated[0].vocabularyItemId, "item-1");
        assert.approximately(result.updated[0].masteryScore, applyCorrect(0.5), 1e-9);
    });

    it("creates a new record (starting from 0.0) for an item never seen before", async () => {
        const progressDocs: any[] = [];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyVocabularyResults({} as any, config);

        await delegate.do(makeRequest());

        assert.equal(progressDocs.length, 1);
        assert.approximately(progressDocs[0].masteryScore, applyCorrect(0.0), 1e-9);
    });

    it("decreases the score for an incorrect answer", async () => {
        const progressDocs = [makeProgress({ masteryScore: 0.5 }).toBSON()];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyVocabularyResults({} as any, config);

        await delegate.do(makeRequest({
            results: [{
                vocabularyItemId: "item-1",
                result: makeResult({ exerciseId: "ex-2", isCorrect: false, userAnswer: "kat", timestamp: "2026-06-01T10:05:00.000Z" }),
            }],
        }));

        assert.approximately(progressDocs[0].masteryScore, applyIncorrect(0.5), 1e-9);
    });

    it("processes each item in the batch independently and atomically", async () => {
        const progressDocs = [
            makeProgress({ vocabularyItemId: "item-1", masteryScore: 0.5 }).toBSON(),
            makeProgress({ vocabularyItemId: "item-2", masteryScore: 0.3 }).toBSON(),
        ];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyVocabularyResults({} as any, config);

        const result = await delegate.do(makeRequest({
            results: [
                { vocabularyItemId: "item-1", result: makeResult({ exerciseId: "ex-1", isCorrect: true }) },
                { vocabularyItemId: "item-2", result: makeResult({ exerciseId: "ex-2", isCorrect: false, userAnswer: "kat", correctAnswer: "kat-foo", timestamp: "2026-06-01T10:01:00.000Z" }) },
            ],
        }));

        assert.equal(result.updated.length, 2);
        const item1 = progressDocs.find(d => d.vocabularyItemId === "item-1");
        const item2 = progressDocs.find(d => d.vocabularyItemId === "item-2");
        assert.approximately(item1.masteryScore, applyCorrect(0.5), 1e-9);
        assert.approximately(item2.masteryScore, applyIncorrect(0.3), 1e-9);
    });
});
