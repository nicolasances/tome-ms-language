import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ParsedExerciseInput, parseExerciseInput } from "../../util/ExerciseValidation";

export class PostExercises extends TotoDelegate<PostExercisesRequest, PostExercisesResponse> {

    /**
     * Parses moduleId (from body, required) and exercises[] (from body, non-empty array required).
     * Delegates per-exercise validation to parseExerciseInput.
     */
    parseRequest(req: Request): PostExercisesRequest {

        const { moduleId, exercises } = req.body ?? {};

        if (!moduleId) throw new ValidationError(400, "moduleId is required");
        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => parseExerciseInput(ex, i));

        return { moduleId, exercises: parsedExercises };
    }

    /**
     * Batch-inserts exercises into the exercises collection.
     * Returns the server-generated ids of the inserted exercises.
     * No bank document is created or updated.
     */
    async do(req: PostExercisesRequest, _userContext?: UserContext): Promise<PostExercisesResponse> {

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

        return { exerciseIds };
    }

}

interface PostExercisesRequest {
    moduleId: string;
    exercises: ParsedExerciseInput[];
}

interface PostExercisesResponse {
    exerciseIds: string[];
}
