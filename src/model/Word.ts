import { WithId } from "mongodb";

export class Word {

    id?: string;
    language: string;
    english: string;
    translation: string;
    createdAt: string;

    constructor(language: string, english: string, translation: string, createdAt: string, id?: string) {
        this.language = language;
        this.english = english;
        this.translation = translation;
        this.createdAt = createdAt;
        this.id = id;
    }

    static fromBSON(data: WithId<any>): Word {
        return new Word(
            data.language,
            data.english,
            data.translation,
            data.createdAt,
            data._id.toString()
        );
    }

    toBSON(): any {
        return {
            language: this.language,
            english: this.english,
            translation: this.translation,
            createdAt: this.createdAt,
        };
    }
}
