import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { CEFR_LEVELS } from "../../model/CefrLevels";
import { Exercise } from "../../model/Exercise";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestBankStore } from "../../store/LevelTestBankStore";
import { ParsedExerciseInput, parseExerciseInput } from "../../util/ExerciseValidation";

export class PostLevelTestBankExercises extends TotoDelegate<PostLevelTestBankExercisesRequest, PostLevelTestBankExercisesResponse> {

    /**
     * Parses cefrLevel (from path params, must be a valid CEFR level) and exercises[] (from body, non-empty array required).
     * Delegates per-exercise validation to parseExerciseInput.
     */
    parseRequest(req: Request): PostLevelTestBankExercisesRequest {

        const { cefrLevel } = req.params;
        const { exercises } = req.body ?? {};

        if (!cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);
        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => parseExerciseInput(ex, i));

        return { cefrLevel, exercises: parsedExercises };
    }

    /**
     * Appends exercises to an existing level test bank.
     * Inserts the exercises into the exercises collection with moduleId = null (enforced here), then appends their ids to the bank,
     * incrementing totalGenerated and updating generatedAt.
     * Rejects with 404 if no bank exists for the level.
     */
    async do(req: PostLevelTestBankExercisesRequest, _userContext?: UserContext): Promise<PostLevelTestBankExercisesResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const bankStore = new LevelTestBankStore(db);

        const existing = await bankStore.findByCefrLevel(req.cefrLevel);

        if (!existing) throw new ValidationError(404, `No level test bank found for level '${req.cefrLevel}'`);

        const exercises = req.exercises.map(ex => new Exercise({
            id: new ObjectId().toString(),
            moduleId: null,
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

        const exerciseStore = new ExerciseStore(db);

        const insertResult = await exerciseStore.insertBatch(exercises);

        const bank = await bankStore.appendExerciseIds(req.cefrLevel, insertResult.inserted, new Date().toISOString());

        return { id: bank!.id, cefrLevel: bank!.cefrLevel, addedExerciseIds: insertResult.inserted, totalGenerated: bank!.totalGenerated };
    }

}

interface PostLevelTestBankExercisesRequest {
    cefrLevel: string;                      // The CEFR level of the bank to append to.
    exercises: ParsedExerciseInput[];       // The cross-module exercises to append.
}

interface PostLevelTestBankExercisesResponse {
    id: string;                 // The id of the bank.
    cefrLevel: string;          // The CEFR level the bank covers.
    addedExerciseIds: string[]; // Ids of the exercises appended in this call.
    totalGenerated: number;     // Cumulative count of exercises in the bank after appending.
}
