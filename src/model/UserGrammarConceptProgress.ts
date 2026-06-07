import { WithId } from "mongodb";
import { ExerciseResult } from "./ExerciseResult";

export class UserGrammarConceptProgress {

    userId: string;
    grammarConceptId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: ExerciseResult[];

    constructor({ userId, grammarConceptId, masteryScore, lastReviewed, exerciseHistory }: UserGrammarConceptProgressInput) {
        this.userId = userId;
        this.grammarConceptId = grammarConceptId;
        this.masteryScore = masteryScore;
        this.lastReviewed = lastReviewed;
        this.exerciseHistory = exerciseHistory;
    }

    static fromBSON(data: WithId<any>): UserGrammarConceptProgress {
        return new UserGrammarConceptProgress({
            userId: data.userId,
            grammarConceptId: data.grammarConceptId,
            masteryScore: data.masteryScore,
            lastReviewed: data.lastReviewed ?? null,
            exerciseHistory: (data.exerciseHistory ?? []).map((r: any) => ExerciseResult.fromBSON(r)),
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            grammarConceptId: this.grammarConceptId,
            masteryScore: this.masteryScore,
            lastReviewed: this.lastReviewed,
            exerciseHistory: this.exerciseHistory.map(r => r.toBSON()),
        };
    }
}

interface UserGrammarConceptProgressInput {
    userId: string;
    grammarConceptId: string;
    masteryScore: number;
    lastReviewed: string | null;
    exerciseHistory: ExerciseResult[];
}
