import { WithId } from "mongodb";
import { ExerciseResult } from "./ExerciseResult";

export class UserVocabularyProgress {

    userId: string;
    vocabularyItemId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: ExerciseResult[];

    constructor({ userId, vocabularyItemId, masteryScore, lastReviewed, exerciseHistory }: UserVocabularyProgressInput) {
        this.userId = userId;
        this.vocabularyItemId = vocabularyItemId;
        this.masteryScore = masteryScore;
        this.lastReviewed = lastReviewed;
        this.exerciseHistory = exerciseHistory;
    }

    static fromBSON(data: WithId<any>): UserVocabularyProgress {
        return new UserVocabularyProgress({
            userId: data.userId,
            vocabularyItemId: data.vocabularyItemId,
            masteryScore: data.masteryScore,
            lastReviewed: data.lastReviewed ?? null,
            exerciseHistory: (data.exerciseHistory ?? []).map((r: any) => ExerciseResult.fromBSON(r)),
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            vocabularyItemId: this.vocabularyItemId,
            masteryScore: this.masteryScore,
            lastReviewed: this.lastReviewed,
            exerciseHistory: this.exerciseHistory.map(r => r.toBSON()),
        };
    }
}

interface UserVocabularyProgressInput {
    userId: string;
    vocabularyItemId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: ExerciseResult[];
}
