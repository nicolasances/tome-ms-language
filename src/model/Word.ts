import { WithId } from "mongodb";

export class Word {

    id?: string;
    language: string;
    english: string;
    translation: string;
    createdAt: string;
    knowledgeSource?: string;

    constructor(language: string, english: string, translation: string, createdAt: string, id?: string, knowledgeSource?: string) {
        this.language = language;
        this.english = english.toLowerCase();
        this.translation = translation.toLowerCase();
        this.createdAt = createdAt;
        this.id = id;
        this.knowledgeSource = knowledgeSource;
    }

    static fromBSON(data: WithId<any>): Word {
        return new Word(
            data.language,
            data.english,
            data.translation,
            data.createdAt,
            data._id.toString(),
            data.knowledgeSource
        );
    }

    toBSON(): any {
        const doc: any = {
            language: this.language,
            english: this.english,
            translation: this.translation,
            createdAt: this.createdAt,
        };
        if (this.knowledgeSource !== undefined) doc.knowledgeSource = this.knowledgeSource;
        return doc;
    }
}
