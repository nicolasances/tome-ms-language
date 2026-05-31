import { WithId } from "mongodb";

export const VOCABULARY_ITEM_TYPES = ["noun", "verb", "adjective", "adverb", "phrase", "pattern", "connector", "pronoun", "number"] as const;
export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const VOCABULARY_ITEM_SOURCES = ["curriculum", "user_added"] as const;

export class VocabularyItem {

    id: string;
    danish: string;
    english: string;
    type: string;
    context: string | null;
    tags: string[];
    cefrLevel: string;
    source: string;
    addedByUserId: string | null;

    constructor({ id, danish, english, type, context, tags, cefrLevel, source, addedByUserId }: VocabularyItemInput) {
        this.id = id;
        this.danish = danish;
        this.english = english;
        this.type = type;
        this.context = context;
        this.tags = tags ?? [];
        this.cefrLevel = cefrLevel;
        this.source = source;
        this.addedByUserId = addedByUserId;
    }

    static fromBSON(data: WithId<any>): VocabularyItem {
        return new VocabularyItem({
            id: data.id,
            danish: data.danish,
            english: data.english,
            type: data.type,
            context: data.context ?? null,
            tags: data.tags ?? [],
            cefrLevel: data.cefrLevel,
            source: data.source,
            addedByUserId: data.addedByUserId ?? null,
        });
    }

    toBSON(): any {
        return {
            id: this.id,
            danish: this.danish,
            english: this.english,
            type: this.type,
            context: this.context,
            tags: this.tags,
            cefrLevel: this.cefrLevel,
            source: this.source,
            addedByUserId: this.addedByUserId,
        };
    }
}

interface VocabularyItemInput {
    id: string;
    danish: string;
    english: string;
    type: string;
    context: string | null;
    tags?: string[];
    cefrLevel: string;
    source: string;
    addedByUserId: string | null;
}
