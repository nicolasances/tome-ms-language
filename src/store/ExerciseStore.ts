import { Db } from "mongodb";
import { Exercise } from "../model/Exercise";

const EXERCISES_COLLECTION = "exercises";

export interface InsertBatchResult {
    inserted: string[];
    duplicatesSkipped: number;
}

export class ExerciseStore {

    private db: Db;

    constructor(db: Db) {
        this.db = db;
    }

    /**
     * Batch-inserts exercise documents into the collection.
     * Deduplicates by (moduleId, type, prompt): exercises matching an existing tuple are silently skipped.
     * Returns the ids of the inserted exercises and the count of skipped duplicates.
     */
    async insertBatch(exercises: Exercise[]): Promise<InsertBatchResult> {

        if (exercises.length === 0) return { inserted: [], duplicatesSkipped: 0 };

        const moduleIds = [...new Set(exercises.map(e => e.moduleId).filter((id): id is string => id !== null))];

        const existing = await this.db.collection(EXERCISES_COLLECTION)
            .find({ moduleId: { $in: moduleIds } }, { projection: { moduleId: 1, type: 1, prompt: 1 } } as any)
            .toArray();

        const existingKeys = new Set(existing.map((e: any) => `${e.moduleId}::${e.type}::${e.prompt}`));

        const toInsert = exercises.filter(e => !existingKeys.has(`${e.moduleId}::${e.type}::${e.prompt}`));
        const duplicatesSkipped = exercises.length - toInsert.length;

        if (toInsert.length > 0) {
            await this.db.collection(EXERCISES_COLLECTION).insertMany(toInsert.map(e => e.toBSON()), { ordered: false });
        }

        return { inserted: toInsert.map(e => e.id), duplicatesSkipped };
    }

    /**
     * Appends a user-contributed answer string to the exercise's userContributedAnswers array.
     * Returns false if no exercise matched (not found), true otherwise.
     */
    async appendUserContributedAnswer(id: string, answer: string): Promise<boolean> {

        const result = await this.db.collection(EXERCISES_COLLECTION).updateOne({ id }, { $push: { userContributedAnswers: answer } } as any);

        return result.matchedCount > 0;
    }

    /**
     * Increments timesShown by 1 for the given exercise.
     * Returns false if no exercise matched (not found), true otherwise.
     */
    async incrementTimesShown(id: string): Promise<boolean> {

        const result = await this.db.collection(EXERCISES_COLLECTION).updateOne({ id }, { $inc: { timesShown: 1 } });

        return result.matchedCount > 0;
    }

    /**
     * Lists all exercises for a given moduleId.
     */
    async listByModuleId(moduleId: string): Promise<Exercise[]> {

        const docs = await this.db.collection(EXERCISES_COLLECTION).find({ moduleId }).toArray();

        return docs.map(doc => Exercise.fromBSON(doc as any));
    }

    /**
     * Finds a single exercise by its id.
     * Returns null if not found.
     */
    async findById(id: string): Promise<Exercise | null> {

        const doc = await this.db.collection(EXERCISES_COLLECTION).findOne({ id });

        if (!doc) return null;

        return Exercise.fromBSON(doc as any);
    }

}
