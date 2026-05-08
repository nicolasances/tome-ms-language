import { WithId } from "mongodb";

export class Sentence {

    id?: string;
    language: string;
    sentence: string;
    translation: string;
    createdAt: string;
    knowledgeSource: string;

    constructor({ language, sentence, translation, createdAt, id, knowledgeSource }: {
        language: string;
        sentence: string;
        translation: string;
        createdAt: string;
        id?: string;
        knowledgeSource: string;
    }) {
        this.language = language;
        this.sentence = sentence;
        this.translation = translation;
        this.createdAt = createdAt;
        this.id = id;
        this.knowledgeSource = knowledgeSource;
    }

    static fromBSON(data: WithId<any>): Sentence {
        return new Sentence({
            language: data.language,
            sentence: data.sentence,
            translation: data.translation,
            createdAt: data.createdAt,
            id: data._id.toString(),
            knowledgeSource: data.knowledgeSource,
        });
    }

    toBSON(): any {
        return {
            language: this.language,
            sentence: this.sentence,
            translation: this.translation,
            createdAt: this.createdAt,
            knowledgeSource: this.knowledgeSource,
        };
    }
}
