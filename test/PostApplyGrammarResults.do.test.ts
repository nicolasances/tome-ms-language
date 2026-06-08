import { assert } from "chai";
import { ExerciseResult } from "../src/model/ExerciseResult";
import { UserGrammarConceptProgress } from "../src/model/UserGrammarConceptProgress";
import { PostApplyGrammarResults } from "../src/dlg/progress/PostApplyGrammarResults";
import { applyCorrect, applyIncorrect } from "../src/util/SrsAlgorithm";

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

function makeResult(overrides: Partial<ConstructorParameters<typeof ExerciseResult>[0]> = {}): ExerciseResult {
    return new ExerciseResult({
        exerciseId: "ex-1",
        type: "error_correction",
        isCorrect: true,
        userAnswer: "Jeg kan ikke",
        correctAnswer: "Jeg kan ikke",
        timestamp: "2026-06-01T10:00:00.000Z",
        moduleId: "mod-1",
        ...overrides,
    });
}

function makeMockConfig(progressDocs: any[]) {
    const progressCol = {
        findOne: async (filter: any) =>
            progressDocs.find(d => d.userId === filter.userId && d.grammarConceptId === filter.grammarConceptId) ?? null,
        replaceOne: async (_filter: any, doc: any, _opts: any) => {
            const idx = progressDocs.findIndex(d => d.userId === doc.userId && d.grammarConceptId === doc.grammarConceptId);
            if (idx >= 0) progressDocs[idx] = doc; else progressDocs.push(doc);
            return {};
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => progressCol }),
    } as any;
}

function makeRequest(overrides: { userId?: string; results?: { grammarConceptId: string; result: ExerciseResult }[] } = {}) {
    return {
        userId: overrides.userId ?? "user-1",
        results: overrides.results ?? [
            { grammarConceptId: "gc-inversion", result: makeResult() },
        ],
    };
}

describe("PostApplyGrammarResults.do", () => {

    it("recomputes the mastery score for an existing record on a correct answer", async () => {
        const progressDocs = [makeProgress({ masteryScore: 0.5 }).toBSON()];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyGrammarResults({} as any, config);

        const result = await delegate.do(makeRequest());

        assert.approximately(progressDocs[0].masteryScore, applyCorrect(0.5), 1e-9);
        assert.equal(result.updated.length, 1);
        assert.equal(result.updated[0].grammarConceptId, "gc-inversion");
        assert.approximately(result.updated[0].masteryScore, applyCorrect(0.5), 1e-9);
    });

    it("creates a new record (starting from 0.0) for a concept never seen before", async () => {
        const progressDocs: any[] = [];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyGrammarResults({} as any, config);

        await delegate.do(makeRequest());

        assert.equal(progressDocs.length, 1);
        assert.approximately(progressDocs[0].masteryScore, applyCorrect(0.0), 1e-9);
    });

    it("decreases the score for an incorrect answer", async () => {
        const progressDocs = [makeProgress({ masteryScore: 0.5 }).toBSON()];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyGrammarResults({} as any, config);

        await delegate.do(makeRequest({
            results: [{
                grammarConceptId: "gc-inversion",
                result: makeResult({ exerciseId: "ex-2", isCorrect: false, userAnswer: "Jeg ikke kan", timestamp: "2026-06-01T10:05:00.000Z" }),
            }],
        }));

        assert.approximately(progressDocs[0].masteryScore, applyIncorrect(0.5), 1e-9);
    });

    it("processes each concept in the batch independently and atomically", async () => {
        const progressDocs = [
            makeProgress({ grammarConceptId: "gc-inversion", masteryScore: 0.5 }).toBSON(),
            makeProgress({ grammarConceptId: "gc-modal-verbs", masteryScore: 0.3 }).toBSON(),
        ];
        const config = makeMockConfig(progressDocs);
        const delegate = new PostApplyGrammarResults({} as any, config);

        const result = await delegate.do(makeRequest({
            results: [
                { grammarConceptId: "gc-inversion", result: makeResult({ exerciseId: "ex-1", isCorrect: true }) },
                { grammarConceptId: "gc-modal-verbs", result: makeResult({ exerciseId: "ex-2", isCorrect: false, userAnswer: "kan jeg ikke", correctAnswer: "kan jeg", timestamp: "2026-06-01T10:01:00.000Z" }) },
            ],
        }));

        assert.equal(result.updated.length, 2);
        const concept1 = progressDocs.find(d => d.grammarConceptId === "gc-inversion");
        const concept2 = progressDocs.find(d => d.grammarConceptId === "gc-modal-verbs");
        assert.approximately(concept1.masteryScore, applyCorrect(0.5), 1e-9);
        assert.approximately(concept2.masteryScore, applyIncorrect(0.3), 1e-9);
    });
});
