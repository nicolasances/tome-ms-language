import { Db } from "mongodb";
import { Exercise } from "../model/Exercise";

const EXERCISES_COLLECTION = "exercises";

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
