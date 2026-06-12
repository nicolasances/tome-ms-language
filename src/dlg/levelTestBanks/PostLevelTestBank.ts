import { Request } from "express";
import { ObjectId } from "mongodb";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { CEFR_LEVELS } from "../../model/CefrLevels";
import { Exercise } from "../../model/Exercise";
import { LevelTestBank } from "../../model/LevelTestBank";
import { ExerciseStore } from "../../store/ExerciseStore";
import { LevelTestBankStore } from "../../store/LevelTestBankStore";
import { ParsedExerciseInput, parseExerciseInput } from "../../util/ExerciseValidation";

export class PostLevelTestBank extends TotoDelegate<PostLevelTestBankRequest, PostLevelTestBankResponse> {

    /**
     * Parses cefrLevel (from body, required, must be a valid CEFR level) and exercises[] (from body, non-empty array required).
     * Delegates per-exercise validation to parseExerciseInput.
     */
    parseRequest(req: Request): PostLevelTestBankRequest {

        const { cefrLevel, exercises } = req.body ?? {};

        if (!cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);
        if (!Array.isArray(exercises) || exercises.length === 0) throw new ValidationError(400, "exercises must be a non-empty array");

        const parsedExercises = exercises.map((ex: any, i: number) => parseExerciseInput(ex, i));

        return { cefrLevel, exercises: parsedExercises };
    }

    /**
     * Creates a level test bank for the given CEFR level.
     * Inserts the exercises into the exercises collection with moduleId = null (enforced here), then creates the bank document referencing them.
     * Rejects with 409 if a bank already exists for the level.
     */
    async do(req: PostLevelTestBankRequest, _userContext?: UserContext): Promise<PostLevelTestBankResponse> {

        const config = this.config as ControllerConfig;

        const db = await config.getMongoDb(config.getDBName());

        const bankStore = new LevelTestBankStore(db);

        const existing = await bankStore.findByCefrLevel(req.cefrLevel);

        if (existing) throw new ValidationError(409, `A level test bank already exists for level '${req.cefrLevel}'`);

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

        const bank = new LevelTestBank({ id: new ObjectId().toString(), cefrLevel: req.cefrLevel, exerciseIds: insertResult.inserted, generatedAt: new Date().toISOString(), totalGenerated: insertResult.inserted.length });

        await bankStore.insertOne(bank);

        return { id: bank.id, cefrLevel: bank.cefrLevel, exerciseIds: bank.exerciseIds, totalGenerated: bank.totalGenerated };
    }

}

interface PostLevelTestBankRequest {
    cefrLevel: string;                      // The CEFR level the bank covers.
    exercises: ParsedExerciseInput[];       // The cross-module exercises to seed the bank with.
}

interface PostLevelTestBankResponse {
    id: string;                 // The id of the created bank.
    cefrLevel: string;          // The CEFR level the bank covers.
    exerciseIds: string[];      // Ids of the exercises inserted into the bank.
    totalGenerated: number;     // Cumulative count of exercises in the bank.
}
