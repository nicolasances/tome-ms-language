import { Db } from "mongodb";
import { Exercise } from "../model/Exercise";
import { ExerciseBank } from "../model/ExerciseBank";

const EXERCISES_COLLECTION = "exercises";
const EXERCISE_BANKS_COLLECTION = "exerciseBanks";

export class ExerciseStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /**
     * Batch-inserts exercise documents into the collection.
     * Returns the ids of the inserted exercises in the same order.
     */
    async insertBatch(exercises: Exercise[]): Promise<string[]> {

        if (exercises.length === 0) return [];

        await this.db.collection(EXERCISES_COLLECTION).insertMany(exercises.map(e => e.toBSON()), { ordered: false });

        return exercises.map(e => e.id);
    }

    /**
     * Inserts an exercise bank document into the collection.
     * Returns the id of the inserted bank.
     */
    async insertBank(bank: ExerciseBank): Promise<string> {

        await this.db.collection(EXERCISE_BANKS_COLLECTION).insertOne(bank.toBSON());

        return bank.id;
    }

    /**
     * Finds the exercise bank for a given moduleId.
     * Returns null if no bank exists for that module.
     */
    async findBankByModuleId(moduleId: string): Promise<ExerciseBank | null> {

        const doc = await this.db.collection(EXERCISE_BANKS_COLLECTION).findOne({ moduleId });

        if (!doc) return null;

        return ExerciseBank.fromBSON(doc as any);
    }
}
