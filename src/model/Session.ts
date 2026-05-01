import { WithId } from "mongodb";

export interface SessionWord {
    wordId: string;
    english: string;
    translation: string;
}

export interface SessionAnswer {
    entityId: string;
    isCorrect: boolean;
    submittedAt: string;
}

export interface VocabularySessionPayload {
    words: SessionWord[];
    totalWords: number;
    answers: SessionAnswer[];
}

export class Session {

    id?: string;
    userId: string;
    language: string;
    practiceType: string;
    status: string;
    payload: VocabularySessionPayload;
    createdAt: string;
    completedAt: string | null;

    constructor({ id, userId, language, practiceType, status, payload, createdAt, completedAt }: {
        id?: string;
        userId: string;
        language: string;
        practiceType: string;
        status: string;
        payload: VocabularySessionPayload;
        createdAt: string;
        completedAt: string | null;
    }) {
        this.id = id;
        this.userId = userId;
        this.language = language;
        this.practiceType = practiceType;
        this.status = status;
        this.payload = payload;
        this.createdAt = createdAt;
        this.completedAt = completedAt;
    }

    static fromBSON(data: WithId<any>): Session {
        return new Session({
            id: data._id.toString(),
            userId: data.userId,
            language: data.language,
            practiceType: data.practiceType,
            status: data.status,
            payload: data.payload,
            createdAt: data.createdAt,
            completedAt: data.completedAt ?? null,
        });
    }

    toBSON(): any {
        return {
            userId: this.userId,
            language: this.language,
            practiceType: this.practiceType,
            status: this.status,
            payload: this.payload,
            createdAt: this.createdAt,
            completedAt: this.completedAt,
        };
    }
}
