import { WithId } from "mongodb";

export class SentenceStats {

    id?: string;
    userId: string;
    sentenceId: string;
    language: string;
    totalAttempts: number;
    totalFailures: number;
    failureRatio: number;
    lastPracticed: string;
    updatedAt: string;

    constructor({ id, userId, sentenceId, language, totalAttempts, totalFailures, failureRatio, lastPracticed, updatedAt }: {
        id?: string;
        userId: string;
        sentenceId: string;
        language: string;
        totalAttempts: number;
        totalFailures: number;
        failureRatio: number;
        lastPracticed: string;
        updatedAt: string;
    }) {
        this.id = id;
        this.userId = userId;
        this.sentenceId = sentenceId;
        this.language = language;
        this.totalAttempts = totalAttempts;
        this.totalFailures = totalFailures;
        this.failureRatio = failureRatio;
        this.lastPracticed = lastPracticed;
        this.updatedAt = updatedAt;
    }

    static fromBSON(data: WithId<any>): SentenceStats {
        return new SentenceStats({
            id: data._id.toString(),
            userId: data.userId,
            sentenceId: data.sentenceId,
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
            sentenceId: this.sentenceId,
            language: this.language,
            totalAttempts: this.totalAttempts,
            totalFailures: this.totalFailures,
            failureRatio: this.failureRatio,
            lastPracticed: this.lastPracticed,
            updatedAt: this.updatedAt,
        };
    }
}
