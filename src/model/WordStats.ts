import { WithId } from "mongodb";

export class WordStats {

    id?: string;
    userId: string;
    wordId: string;
    language: string;
    totalAttempts: number;
    totalFailures: number;
    failureRatio: number;
    lastPracticed: string;
    updatedAt: string;

    constructor({ id, userId, wordId, language, totalAttempts, totalFailures, failureRatio, lastPracticed, updatedAt }: {
        id?: string;
        userId: string;
        wordId: string;
        language: string;
        totalAttempts: number;
        totalFailures: number;
        failureRatio: number;
        lastPracticed: string;
        updatedAt: string;
    }) {
        this.id = id;
        this.userId = userId;
        this.wordId = wordId;
        this.language = language;
        this.totalAttempts = totalAttempts;
        this.totalFailures = totalFailures;
        this.failureRatio = failureRatio;
        this.lastPracticed = lastPracticed;
        this.updatedAt = updatedAt;
    }

    static fromBSON(data: WithId<any>): WordStats {
        return new WordStats({
            id: data._id.toString(),
            userId: data.userId,
            wordId: data.wordId,
            language: data.language,
            totalAttempts: data.totalAttempts,
            totalFailures: data.totalFailures,
            failureRatio: data.failureRatio,
            lastPracticed: data.lastPracticed,
            updatedAt: data.updatedAt,
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            wordId: this.wordId,
            language: this.language,
            totalAttempts: this.totalAttempts,
            totalFailures: this.totalFailures,
            failureRatio: this.failureRatio,
            lastPracticed: this.lastPracticed,
            updatedAt: this.updatedAt,
        };
    }
}
