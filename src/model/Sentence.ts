import { WithId } from "mongodb";

export interface AlternativeTranslation {
    id: string;
    translation: string;
}

export class Sentence {

    id?: string;
    language: string;
    sentence: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;
    alternativeTranslations: AlternativeTranslation[];

    constructor({ language, sentence, translation, createdAt, id, knowledgeSource, alternativeTranslations }: {
        language: string;
        sentence: string;
        translation: string;
        createdAt: string;
        id?: string;
        knowledgeSource: string;
        alternativeTranslations?: AlternativeTranslation[];
    }) {
        this.language = language;
        this.sentence = sentence;
        this.translation = translation;
        this.createdAt = createdAt;
        this.id = id;
        this.knowledgeSource = knowledgeSource;
        this.alternativeTranslations = alternativeTranslations ?? [];
    }

    static fromBSON(data: WithId<any>): Sentence {
        return new Sentence({
            language: data.language,
            sentence: data.sentence,
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
            sentence: this.sentence,
            translation: this.translation,
            createdAt: this.createdAt,
            knowledgeSource: this.knowledgeSource,
        };
        if (this.alternativeTranslations.length > 0) doc.alternativeTranslations = this.alternativeTranslations;
        return doc;
    }
}
