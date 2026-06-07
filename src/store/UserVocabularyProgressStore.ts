import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { ExerciseResult } from "../model/ExerciseResult";
import { UserVocabularyProgress } from "../model/UserVocabularyProgress";
import { applyCorrect, applyIncorrect } from "../util/SrsAlgorithm";

const COLLECTION = "userVocabularyProgress";

export class UserVocabularyProgressStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findByUserAndItem(userId: string, vocabularyItemId: string): Promise<UserVocabularyProgress | null> {
        const doc = await this.db.collection(COLLECTION).findOne({ userId, vocabularyItemId });
        if (!doc) return null;
        return UserVocabularyProgress.fromBSON(doc);
    }

    async listByUser(userId: string, vocabularyItemIds?: string[]): Promise<UserVocabularyProgress[]> {
        const filter: Record<string, any> = { userId };
        if (vocabularyItemIds) filter.vocabularyItemId = { $in: vocabularyItemIds };
        const docs = await this.db.collection(COLLECTION).find(filter).toArray();
        return docs.map(doc => UserVocabularyProgress.fromBSON(doc));
    }

    async upsert(progress: UserVocabularyProgress): Promise<UserVocabularyProgress> {
        await this.db.collection(COLLECTION).replaceOne(
            { userId: progress.userId, vocabularyItemId: progress.vocabularyItemId },
            progress.toBSON(),
            { upsert: true }
        );
        return progress;
    }

    /**
     * Appends an ExerciseResult to the item's history and recomputes its
     * masteryScore (via the SRS algorithm) and lastReviewed in one
     * atomic-per-item operation. Creates the record (starting from a
     * masteryScore of 0.0) if the item has never been reviewed before.
     */
    async appendResultAndRecompute(userId: string, vocabularyItemId: string, result: ExerciseResult): Promise<UserVocabularyProgress> {
        const existing = await this.findByUserAndItem(userId, vocabularyItemId);
        const currentScore = existing?.masteryScore ?? 0.0;
        const newScore = result.isCorrect ? applyCorrect(currentScore) : applyIncorrect(currentScore);

        const updated = new UserVocabularyProgress({
            userId,
            vocabularyItemId,
            masteryScore: newScore,
            lastReviewed: result.timestamp,
            exerciseHistory: [...(existing?.exerciseHistory ?? []), result],
        });

        return this.upsert(updated);
    }
}
