import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { ExerciseResult } from "../model/ExerciseResult";
import { UserGrammarConceptProgress } from "../model/UserGrammarConceptProgress";
import { applyCorrect, applyIncorrect } from "../util/SrsAlgorithm";

const COLLECTION = "userGrammarProgress";

export class UserGrammarConceptProgressStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findByUserAndConcept(userId: string, grammarConceptId: string): Promise<UserGrammarConceptProgress | null> {
        const doc = await this.db.collection(COLLECTION).findOne({ userId, grammarConceptId });
        if (!doc) return null;
        return UserGrammarConceptProgress.fromBSON(doc);
    }

    async listByUser(userId: string, grammarConceptIds?: string[]): Promise<UserGrammarConceptProgress[]> {
        const filter: Record<string, any> = { userId };
        if (grammarConceptIds) filter.grammarConceptId = { $in: grammarConceptIds };
        const docs = await this.db.collection(COLLECTION).find(filter).toArray();
        return docs.map(doc => UserGrammarConceptProgress.fromBSON(doc));
    }

    async upsert(progress: UserGrammarConceptProgress): Promise<UserGrammarConceptProgress> {
        await this.db.collection(COLLECTION).replaceOne(
            { userId: progress.userId, grammarConceptId: progress.grammarConceptId },
            progress.toBSON(),
            { upsert: true }
        );
        return progress;
    }

    /**
     * Appends an ExerciseResult to the concept's history and recomputes its
     * masteryScore (via the SRS algorithm) and lastReviewed in one
     * atomic-per-concept operation. Creates the record (starting from a
     * masteryScore of 0.0) if the concept has never been reviewed before.
     */
    async appendResultAndRecompute(userId: string, grammarConceptId: string, result: ExerciseResult): Promise<UserGrammarConceptProgress> {
        const existing = await this.findByUserAndConcept(userId, grammarConceptId);
        const currentScore = existing?.masteryScore ?? 0.0;
        const newScore = result.isCorrect ? applyCorrect(currentScore) : applyIncorrect(currentScore);

        const updated = new UserGrammarConceptProgress({
            userId,
            grammarConceptId,
            masteryScore: newScore,
            lastReviewed: result.timestamp,
            exerciseHistory: [...(existing?.exerciseHistory ?? []), result],
        });

        return this.upsert(updated);
    }
}
