import { WithId } from "mongodb";

export class Word {

    id?: string;
    language: string;
    english: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;

    constructor({ language, english, translation, createdAt, id, knowledgeSource }: { language: string, english: string, translation: string, createdAt: string, id?: string, knowledgeSource: string }) {
        this.language = language;
        this.english = english.toLowerCase();
        this.translation = translation.toLowerCase();
        this.createdAt = createdAt;
        this.id = id;
        this.knowledgeSource = knowledgeSource;
    }

    static fromBSON(data: WithId<any>): Word {
        return new Word({
            language: data.language,
            english: data.english,
            translation: data.translation,
            createdAt: data.createdAt,
            id: data._id.toString(),
            knowledgeSource: data.knowledgeSource
        });
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
