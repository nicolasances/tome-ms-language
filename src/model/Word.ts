import { WithId } from "mongodb";

export interface AlternativeTranslation {
    id: string;
    translation: string;
}

export class Word {

    id?: string;
    language: string;
    english: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    alternativeTranslations: AlternativeTranslation[];

    constructor({ language, english, translation, createdAt, id, knowledgeSource, alternativeTranslations }: { language: string, english: string, translation: string, createdAt: string, id?: string, knowledgeSource: string, alternativeTranslations?: AlternativeTranslation[] }) {
        this.language = language;
        this.english = english.toLowerCase();
        this.translation = translation.toLowerCase();
        this.createdAt = createdAt;
        this.id = id;
        this.knowledgeSource = knowledgeSource;
        this.alternativeTranslations = alternativeTranslations ?? [];
    }

    static fromBSON(data: WithId<any>): Word {
        return new Word({
            language: data.language,
            english: data.english,
            translation: data.translation,
            createdAt: data.createdAt,
            id: data._id.toString(),
            knowledgeSource: data.knowledgeSource,
            alternativeTranslations: data.alternativeTranslations ?? [],
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
        if (this.alternativeTranslations.length > 0) doc.alternativeTranslations = this.alternativeTranslations;
        return doc;
    }
}
