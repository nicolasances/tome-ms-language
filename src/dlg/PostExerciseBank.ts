import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Exercise, EXERCISE_TYPES, GRAMMAR_LINKED_TYPES, PROMPT_TRANSLATION_REQUIRED_TYPES, VOCAB_LINKED_TYPES } from "../model/Exercise";
import { ExerciseBank } from "../model/ExerciseBank";
import { ExerciseStore } from "../store/ExerciseStore";

export class PostExerciseBank extends TotoDelegate<PostExerciseBankRequest, PostExerciseBankResponse> {

    parseRequest(req: Request): PostExerciseBankRequest {

        const { moduleId, exercises } = req.body ?? {};

        if (!moduleId) throw new ValidationError(400, "moduleId is required");
        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => this.parseExercise(ex, i));

        return { moduleId, exercises: parsedExercises };
    }

    async do(req: PostExerciseBankRequest, _userContext?: UserContext): Promise<PostExerciseBankResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);

        const exercises = req.exercises.map(ex => new Exercise({
            id: new ObjectId().toString(),
            moduleId: req.moduleId,
            type: ex.type,
            prompt: ex.prompt,
            promptTranslation: ex.promptTranslation ?? null,
            answer: ex.answer,
            alternativeAnswers: ex.alternativeAnswers ?? [],
            words: ex.words ?? null,
            distractors: ex.distractors ?? null,
            vocabularyItemId: ex.vocabularyItemId ?? null,
            grammarConceptId: ex.grammarConceptId ?? null,
        }));

        const exerciseIds = await store.insertBatch(exercises);

        const bank = new ExerciseBank({
            id: new ObjectId().toString(),
            moduleId: req.moduleId,
            exerciseIds,
            generatedAt: new Date(),
            totalGenerated: exerciseIds.length,
        });

        await store.insertBank(bank);

        return { bank };
    }

    private parseExercise(ex: any, index: number): ParsedExercise {

        const prefix = `exercises[${index}]`;

        if (!ex.type || !(EXERCISE_TYPES as readonly string[]).includes(ex.type)) {
            throw new ValidationError(400, `${prefix}.type must be one of: ${EXERCISE_TYPES.join(", ")}`);
        }

        if (!ex.prompt) throw new ValidationError(400, `${prefix}.prompt is required`);
        if (!ex.answer) throw new ValidationError(400, `${prefix}.answer is required`);

        const hasVocabId = !!ex.vocabularyItemId;
        const hasGrammarId = !!ex.grammarConceptId;

        if (hasVocabId && hasGrammarId) throw new ValidationError(400, `${prefix}: exactly one of vocabularyItemId / grammarConceptId must be set, not both`);
        if (!hasVocabId && !hasGrammarId) throw new ValidationError(400, `${prefix}: exactly one of vocabularyItemId / grammarConceptId must be set`);

        if ((VOCAB_LINKED_TYPES as readonly string[]).includes(ex.type) && !hasVocabId) {
            throw new ValidationError(400, `${prefix}: type '${ex.type}' requires vocabularyItemId`);
        }

        if ((GRAMMAR_LINKED_TYPES as readonly string[]).includes(ex.type) && !hasGrammarId) {
            throw new ValidationError(400, `${prefix}: type '${ex.type}' requires grammarConceptId`);
        }

        if ((PROMPT_TRANSLATION_REQUIRED_TYPES as readonly string[]).includes(ex.type) && !ex.promptTranslation) {
            throw new ValidationError(400, `${prefix}: type '${ex.type}' requires promptTranslation`);
        }

        if (ex.type === "sentence_reorder" && (!Array.isArray(ex.words) || ex.words.length === 0)) {
            throw new ValidationError(400, `${prefix}: type 'sentence_reorder' requires a non-empty words array`);
        }

        if (ex.type === "multiple_choice" && (!Array.isArray(ex.distractors) || ex.distractors.length === 0)) {
            throw new ValidationError(400, `${prefix}: type 'multiple_choice' requires a non-empty distractors array`);
        }

        return {
            type: ex.type,
            prompt: ex.prompt,
            promptTranslation: ex.promptTranslation ?? null,
            answer: ex.answer,
            alternativeAnswers: Array.isArray(ex.alternativeAnswers) ? ex.alternativeAnswers : [],
            words: Array.isArray(ex.words) ? ex.words : null,
            distractors: Array.isArray(ex.distractors) ? ex.distractors : null,
            vocabularyItemId: ex.vocabularyItemId ?? null,
            grammarConceptId: ex.grammarConceptId ?? null,
        };
    }
}

interface ParsedExercise {
    type: string;
    prompt: string;
    promptTranslation: string | null;
    answer: string;
    alternativeAnswers: string[];
    words: string[] | null;
    distractors: string[] | null;
    vocabularyItemId: string | null;
    grammarConceptId: string | null;
}

interface PostExerciseBankRequest {
    moduleId: string;
    exercises: ParsedExercise[];
}

interface PostExerciseBankResponse {
    bank: ExerciseBank;
}
