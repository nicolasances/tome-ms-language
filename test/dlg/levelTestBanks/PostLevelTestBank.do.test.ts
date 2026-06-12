import { assert } from "chai";
import { PostLevelTestBank } from "../../../src/dlg/levelTestBanks/PostLevelTestBank";

function makeExerciseInput(overrides: Record<string, any> = {}) {
    return { type: "translation_active", prompt: "I eat", promptTranslation: null, answer: "jeg spiser", alternativeAnswers: [], words: null, distractors: null, vocabularyItemId: "vocab-1", grammarConceptId: null, ...overrides };
}

/**
 * Builds a mock config tracking exercises inserted and the bank inserted.
 * existingBank: a pre-existing levelTestBanks doc (or null).
 */
function makeMockConfig(existingBank: any) {

    const insertedExercises: any[] = [];
    const insertedBanks: any[] = [];
    const banks: any[] = existingBank ? [existingBank] : [];

    const collections: Record<string, any> = {
        exercises: {
            find: (_filter: any, _opts: any) => ({ toArray: async () => [] }),
            insertMany: async (docs: any[], _opts: any) => { insertedExercises.push(...docs); return {}; },
        },
        levelTestBanks: {
            findOne: async (filter: any) => banks.find(b => b.cefrLevel === filter.cefrLevel) ?? null,
            insertOne: async (doc: any) => { insertedBanks.push(doc); banks.push(doc); return { insertedId: "mock" }; },
        },
    };

    return {
        config: {
            getDBName: () => "test",
            getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
        } as any,
        insertedExercises,
        insertedBanks,
    };
}

describe("PostLevelTestBank.do", () => {

    it("inserts exercises with moduleId=null, creates the bank and returns its ids", async () => {

        const { config, insertedExercises, insertedBanks } = makeMockConfig(null);
        const delegate = new PostLevelTestBank({} as any, config);

        const result = await delegate.do({ cefrLevel: "A1", exercises: [makeExerciseInput(), makeExerciseInput({ prompt: "I drink", answer: "jeg drikker" })] });

        assert.equal(insertedExercises.length, 2);
        assert.isTrue(insertedExercises.every(e => e.moduleId === null), "all exercises must have moduleId null");

        assert.equal(insertedBanks.length, 1);
        assert.equal(result.cefrLevel, "A1");
        assert.equal(result.exerciseIds.length, 2);
        assert.equal(result.totalGenerated, 2);
        assert.deepEqual(result.exerciseIds, insertedExercises.map(e => e.id));
    });

    it("throws 409 when a bank already exists for the level", async () => {

        const existingBank = { id: "bank-1", cefrLevel: "A1", exerciseIds: [], generatedAt: "2026-06-12T10:00:00.000Z", totalGenerated: 0 };
        const { config, insertedExercises } = makeMockConfig(existingBank);
        const delegate = new PostLevelTestBank({} as any, config);

        try {
            await delegate.do({ cefrLevel: "A1", exercises: [makeExerciseInput()] });
            assert.fail("Expected 409");
        } catch (err: any) {
            assert.equal(err.code, 409);
        }

        assert.equal(insertedExercises.length, 0, "must not insert orphan exercises when bank exists");
    });
});
