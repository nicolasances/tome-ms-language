import { assert } from "chai";
import { Exercise } from "../../src/model/Exercise";
import { toClientTestExercise } from "../../src/util/TestExercisePresentation";

function makeMultipleChoice(): Exercise {
    return new Exercise({
        id: "ex-mc",
        moduleId: "mod-1",
        type: "multiple_choice",
        prompt: "Choose the correct form",
        promptTranslation: "Choose the correct form",
        answer: "spiser",
        alternativeAnswers: ["spise"],
        userContributedAnswers: ["spiser nu"],
        distractors: ["drikker", "løber", "sover"],
        vocabularyItemId: "v-1",
        grammarConceptId: null,
    });
}

function makeTranslation(): Exercise {
    return new Exercise({
        id: "ex-tr",
        moduleId: "mod-1",
        type: "translation_active",
        prompt: "I eat",
        answer: "jeg spiser",
        alternativeAnswers: ["jeg spiser mad"],
        userContributedAnswers: [],
        vocabularyItemId: "v-1",
        grammarConceptId: null,
    });
}

describe("toClientTestExercise", () => {

    it("strips the correct answer and answer-revealing fields", () => {

        const result = toClientTestExercise(makeMultipleChoice()) as any;

        assert.isUndefined(result.answer, "answer must be stripped");
        assert.isUndefined(result.alternativeAnswers, "alternativeAnswers must be stripped");
        assert.isUndefined(result.userContributedAnswers, "userContributedAnswers must be stripped");
        assert.isUndefined(result.distractors, "distractors must be stripped (would leak the answer via choices minus distractors)");
    });

    it("exposes choices for multiple_choice containing the answer plus distractors", () => {

        const result = toClientTestExercise(makeMultipleChoice());

        assert.isArray(result.choices);
        assert.includeMembers(result.choices as string[], ["spiser", "drikker", "løber", "sover"]);
        assert.lengthOf(result.choices as string[], 4);
    });

    it("orders choices deterministically (so start and resume agree) without revealing the answer position", () => {

        const a = toClientTestExercise(makeMultipleChoice()).choices;
        const b = toClientTestExercise(makeMultipleChoice()).choices;

        assert.deepEqual(a, b, "choices order must be stable across calls");
        assert.deepEqual(a, ["drikker", "løber", "sover", "spiser"].sort((x, y) => x.localeCompare(y)));
    });

    it("returns null choices for non-multiple_choice exercises and keeps the prompt", () => {

        const result = toClientTestExercise(makeTranslation());

        assert.isNull(result.choices);
        assert.equal(result.prompt, "I eat");
    });
});
