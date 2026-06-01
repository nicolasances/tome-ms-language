import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Exercise } from "../model/Exercise";
import { ExerciseBank } from "../model/ExerciseBank";
import { ExerciseStore } from "../store/ExerciseStore";
import { ParsedExerciseInput, parseExerciseInput } from "../util/ExerciseValidation";

export class AppendExercisesToBank extends TotoDelegate<AppendExercisesToBankRequest, AppendExercisesToBankResponse> {

    parseRequest(req: Request): AppendExercisesToBankRequest {

        const { moduleId } = req.params;
        const { exercises } = req.body ?? {};

        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => parseExerciseInput(ex, i));

        return { moduleId, exercises: parsedExercises };
    }

    async do(req: AppendExercisesToBankRequest, _userContext?: UserContext): Promise<AppendExercisesToBankResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new ExerciseStore(db);
        const bank = await store.findBankByModuleId(req.moduleId);

        if (!bank) throw new ValidationError(404, `Exercise bank not found for moduleId '${req.moduleId}'`);

        const exercises = req.exercises.map(ex => new Exercise({
            id: new ObjectId().toString(),
            moduleId: req.moduleId,
            type: ex.type,
            prompt: ex.prompt,
            promptTranslation: ex.promptTranslation,
            answer: ex.answer,
            alternativeAnswers: ex.alternativeAnswers,
            words: ex.words,
            distractors: ex.distractors,
            vocabularyItemId: ex.vocabularyItemId,
            grammarConceptId: ex.grammarConceptId,
        }));

        const newIds = await store.insertBatch(exercises);
        const now = new Date();

        await store.appendExercisesToBank(req.moduleId, newIds, now);

        const updatedBank = await store.findBankByModuleId(req.moduleId);

        return { bank: updatedBank! };
    }
}

interface AppendExercisesToBankRequest {
    moduleId: string;
    exercises: ParsedExerciseInput[];
}

interface AppendExercisesToBankResponse {
    bank: ExerciseBank;
}
