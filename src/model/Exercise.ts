import { WithId } from "mongodb";

export const EXERCISE_TYPES = ["translation_active", "multiple_choice", "fill_blank", "sentence_reorder", "error_correction", "conjugation_drill"] as const;

export const VOCAB_LINKED_TYPES = ["translation_active", "multiple_choice", "fill_blank", "conjugation_drill"] as const;
export const GRAMMAR_LINKED_TYPES = ["sentence_reorder", "error_correction"] as const;

export const PROMPT_TRANSLATION_REQUIRED_TYPES = ["multiple_choice", "fill_blank", "error_correction"] as const;

export class Exercise {

    id: string;
    moduleId: string | null;
    type: string;
    prompt: string;
    promptTranslation: string | null;
    answer: string;
    alternativeAnswers: string[];
    userContributedAnswers: string[];
    words: string[] | null;
    distractors: string[] | null;
    vocabularyItemId: string | null;
    grammarConceptId: string | null;
    timesShown: number;

    constructor(input: ExerciseInput) {

        this.id = input.id;
        this.moduleId = input.moduleId ?? null;
        this.type = input.type;
        this.prompt = input.prompt;
        this.promptTranslation = input.promptTranslation ?? null;
        this.answer = input.answer;
        this.alternativeAnswers = input.alternativeAnswers ?? [];
        this.userContributedAnswers = input.userContributedAnswers ?? [];
        this.words = input.words ?? null;
        this.distractors = input.distractors ?? null;
        this.vocabularyItemId = input.vocabularyItemId ?? null;
        this.grammarConceptId = input.grammarConceptId ?? null;
        this.timesShown = input.timesShown ?? 0;
    }

    /**
     * Creates an Exercise instance from a MongoDB BSON document.
     */
    static fromBSON(data: WithId<any>): Exercise {

        return new Exercise({
            id: data.id,
            moduleId: data.moduleId ?? null,
            type: data.type,
            prompt: data.prompt,
            promptTranslation: data.promptTranslation ?? null,
            answer: data.answer,
            alternativeAnswers: data.alternativeAnswers ?? [],
            userContributedAnswers: data.userContributedAnswers ?? [],
            words: data.words ?? null,
            distractors: data.distractors ?? null,
            vocabularyItemId: data.vocabularyItemId ?? null,
            grammarConceptId: data.grammarConceptId ?? null,
            timesShown: data.timesShown ?? 0,
        });
    }

    /**
     * Serializes the Exercise to a MongoDB BSON document.
     */
    toBSON(): any {

        return {
            id: this.id,
            moduleId: this.moduleId,
            type: this.type,
            prompt: this.prompt,
            promptTranslation: this.promptTranslation,
            answer: this.answer,
            alternativeAnswers: this.alternativeAnswers,
            userContributedAnswers: this.userContributedAnswers,
            words: this.words,
            distractors: this.distractors,
            vocabularyItemId: this.vocabularyItemId,
            grammarConceptId: this.grammarConceptId,
            timesShown: this.timesShown,
        };
    }
}

export interface ExerciseInput {
    id: string;
    moduleId?: string | null;
    type: string;
    prompt: string;
    promptTranslation?: string | null;
    answer: string;
    alternativeAnswers?: string[];
    userContributedAnswers?: string[];
    words?: string[] | null;
    distractors?: string[] | null;
    vocabularyItemId?: string | null;
    grammarConceptId?: string | null;
    timesShown?: number;
}
