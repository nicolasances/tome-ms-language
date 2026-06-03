import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { Exercise } from "../../model/Exercise";
import { ExerciseBank } from "../../model/ExerciseBank";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ParsedExerciseInput, parseExerciseInput } from "../../util/ExerciseValidation";

export class PostExerciseBank extends TotoDelegate<PostExerciseBankRequest, PostExerciseBankResponse> {

    parseRequest(req: Request): PostExerciseBankRequest {

        const { moduleId, exercises } = req.body ?? {};

        if (!moduleId) throw new ValidationError(400, "moduleId is required");
        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => parseExerciseInput(ex, i));

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

}

interface PostExerciseBankRequest {
    moduleId: string;
    exercises: ParsedExerciseInput[];
}

interface PostExerciseBankResponse {
    bank: ExerciseBank;
}

