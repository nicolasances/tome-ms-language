import { assert } from "chai";
import { PostExerciseMistakeExplanation } from "../../../src/dlg/exercises/PostExerciseMistakeExplanation";
import { Exercise } from "../../../src/model/Exercise";
import { VocabularyItem } from "../../../src/model/VocabularyItem";
import { GrammarConcept } from "../../../src/model/GrammarConcept";
import { VertexAIClient } from "../../../src/ai/VertexAIClient";

const AI_RESPONSE = JSON.stringify({
    correctAnswer: "jeg spiser",
    explanation: "The verb 'spise' conjugates to 'spiser' in present tense.",
    rule: "Danish present tense is formed by adding -r to the infinitive.",
    example: "Han drikker vand.",
});

function makeExerciseWithVocab(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "I eat",
        answer: "jeg spiser",
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeExerciseWithGrammar(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "sentence_reorder",
        prompt: "Reorder: spiser / jeg / mad",
        answer: "jeg spiser mad",
        vocabularyItemId: null,
        grammarConceptId: "gram-1",
    }).toBSON();
}

function makeVocabBSON(): any {
    return new VocabularyItem({
        id: "vocab-1",
        danish: "spise",
        english: "to eat",
        type: "verb",
        context: "used for eating food",
        tags: [],
        cefrLevel: "A1",
        source: "curriculum",
        addedByUserId: null,
    }).toBSON();
}

function makeGrammarBSON(): any {
    return new GrammarConcept({
        id: "gram-1",
        name: "Present tense",
        category: "tenses",
        cefrLevelIntroduced: "A1",
        explanation: "Add -r to the infinitive stem.",
        examples: [],
    }).toBSON();
}

function makeMockAIClient(response: string = AI_RESPONSE): VertexAIClient {
    return { generate: async (_prompt: string) => response };
}

/**
 * Builds a mock config that serves the given documents from their respective collections.
 */
function makeMockConfig(exerciseDoc: any, vocabDoc: any, grammarDoc: any) {

    const collections: Record<string, any> = {
        exercises: { findOne: async () => exerciseDoc },
        vocabulary: { findOne: async () => vocabDoc },
        grammar: { findOne: async () => grammarDoc },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

describe("PostExerciseMistakeExplanation.do", () => {

    it("returns correctAnswer, explanation, rule, example when exercise is linked to a vocabulary item", async () => {

        const config = makeMockConfig(makeExerciseWithVocab("ex-1"), makeVocabBSON(), null);
        const delegate = new PostExerciseMistakeExplanation({} as any, config);
        delegate.aiClient = makeMockAIClient();

        const result = await delegate.do(
            { exerciseId: "ex-1", userAnswer: "jeg ede", cefrLevel: "A1" },
            { userId: "user-1" } as any
        );

        assert.equal(result.correctAnswer, "jeg spiser");
        assert.equal(result.explanation, "The verb 'spise' conjugates to 'spiser' in present tense.");
        assert.equal(result.rule, "Danish present tense is formed by adding -r to the infinitive.");
        assert.equal(result.example, "Han drikker vand.");
    });

    it("returns the four fields when exercise is linked to a grammar concept", async () => {

        const config = makeMockConfig(makeExerciseWithGrammar("ex-2"), null, makeGrammarBSON());
        const delegate = new PostExerciseMistakeExplanation({} as any, config);
        delegate.aiClient = makeMockAIClient();

        const result = await delegate.do(
            { exerciseId: "ex-2", userAnswer: "spiser jeg mad", cefrLevel: "A2" },
            { userId: "user-1" } as any
        );

        assert.equal(result.correctAnswer, "jeg spiser");
        assert.equal(result.rule, "Danish present tense is formed by adding -r to the infinitive.");
    });

    it("throws 404 when the exercise does not exist", async () => {

        const config = makeMockConfig(null, null, null);
        const delegate = new PostExerciseMistakeExplanation({} as any, config);
        delegate.aiClient = makeMockAIClient();

        try {

            await delegate.do(
                { exerciseId: "missing", userAnswer: "x", cefrLevel: "A1" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 404 when the linked vocabulary item does not exist", async () => {

        const config = makeMockConfig(makeExerciseWithVocab("ex-3"), null, null);
        const delegate = new PostExerciseMistakeExplanation({} as any, config);
        delegate.aiClient = makeMockAIClient();

        try {

            await delegate.do(
                { exerciseId: "ex-3", userAnswer: "x", cefrLevel: "A1" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 404 when the linked grammar concept does not exist", async () => {

        const config = makeMockConfig(makeExerciseWithGrammar("ex-4"), null, null);
        const delegate = new PostExerciseMistakeExplanation({} as any, config);
        delegate.aiClient = makeMockAIClient();

        try {

            await delegate.do(
                { exerciseId: "ex-4", userAnswer: "x", cefrLevel: "A2" },
                { userId: "user-1" } as any
            );
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });
});
