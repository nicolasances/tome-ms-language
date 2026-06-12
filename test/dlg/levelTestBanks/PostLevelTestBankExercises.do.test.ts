import { assert } from "chai";
import { PostLevelTestBankExercises } from "../../../src/dlg/levelTestBanks/PostLevelTestBankExercises";

function makeExerciseInput(overrides: Record<string, any> = {}) {
    return { type: "translation_active", prompt: "I eat", promptTranslation: null, answer: "jeg spiser", alternativeAnswers: [], words: null, distractors: null, vocabularyItemId: "vocab-1", grammarConceptId: null, ...overrides };
}

/**
 * Builds a mock config tracking inserted exercises and the bank update applied via findOneAndUpdate.
 * existingBank: a pre-existing levelTestBanks doc (or null to simulate a missing bank).
 */
function makeMockConfig(existingBank: any) {

    const insertedExercises: any[] = [];
    const banks: any[] = existingBank ? [existingBank] : [];

    const collections: Record<string, any> = {
        exercises: {
            find: (_filter: any, _opts: any) => ({ toArray: async () => [] }),
            insertMany: async (docs: any[], _opts: any) => { insertedExercises.push(...docs); return {}; },
        },
        levelTestBanks: {
            findOne: async (filter: any) => banks.find(b => b.cefrLevel === filter.cefrLevel) ?? null,
            findOneAndUpdate: async (filter: any, update: any, _opts: any) => {
                const doc = banks.find(b => b.cefrLevel === filter.cefrLevel);
                if (!doc) return null;
                doc.exerciseIds = [...(doc.exerciseIds ?? []), ...update.$push.exerciseIds.$each];
                doc.totalGenerated = (doc.totalGenerated ?? 0) + update.$inc.totalGenerated;
                doc.generatedAt = update.$set.generatedAt;
                return doc;
            },
        },
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        insertedExercises,
        banks,
    };
}

describe("PostLevelTestBankExercises.do", () => {

    it("inserts exercises with moduleId=null and appends their ids to the bank", async () => {

        const existingBank = { id: "bank-1", cefrLevel: "A1", exerciseIds: ["ex-old"], generatedAt: "2026-06-12T10:00:00.000Z", totalGenerated: 1 };
        const { config, insertedExercises, banks } = makeMockConfig(existingBank);
        const delegate = new PostLevelTestBankExercises({} as any, config);

        const result = await delegate.do({ cefrLevel: "A1", exercises: [makeExerciseInput(), makeExerciseInput({ prompt: "I drink", answer: "jeg drikker" })] });

        assert.equal(insertedExercises.length, 2);
        assert.isTrue(insertedExercises.every(e => e.moduleId === null));

        assert.equal(result.addedExerciseIds.length, 2);
        assert.equal(result.totalGenerated, 3);
        assert.deepEqual(banks[0].exerciseIds, ["ex-old", ...insertedExercises.map(e => e.id)]);
    });

    it("throws 404 when no bank exists for the level", async () => {

        const { config, insertedExercises } = makeMockConfig(null);
        const delegate = new PostLevelTestBankExercises({} as any, config);

        try {
            await delegate.do({ cefrLevel: "C1", exercises: [makeExerciseInput()] });
            assert.fail("Expected 404");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }

        assert.equal(insertedExercises.length, 0, "must not insert orphan exercises when bank is missing");
    });
});
