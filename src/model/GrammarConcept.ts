import { WithId } from "mongodb";
import { CEFR_LEVELS } from "./CefrLevels";

export { CEFR_LEVELS };
export const GRAMMAR_CONCEPT_CATEGORIES = ["tenses", "sentence_structure", "verbs", "nouns", "pronouns", "adjectives", "connectors", "advanced"] as const;

export interface GrammarConceptExample {
    danish: string;
    english: string;
}

export class GrammarConcept {

    id: string;
    name: string;
    category: string;
    cefrLevelIntroduced: string;
    explanation: string;
    examples: GrammarConceptExample[];

    constructor({ id, name, category, cefrLevelIntroduced, explanation, examples }: GrammarConceptInput) {

        this.id = id;
        this.name = name;
        this.category = category;
        this.cefrLevelIntroduced = cefrLevelIntroduced;
        this.explanation = explanation;
        this.examples = examples;
    }

    static fromBSON(data: WithId<any>): GrammarConcept {

        return new GrammarConcept({
            id: data.id,
            name: data.name,
            category: data.category,
            cefrLevelIntroduced: data.cefrLevelIntroduced,
            explanation: data.explanation,
            examples: data.examples ?? [],
        });
    }

    toBSON(): any {

        return {
            id: this.id,
            name: this.name,
            category: this.category,
            cefrLevelIntroduced: this.cefrLevelIntroduced,
            explanation: this.explanation,
            examples: this.examples,
        };
    }
}

interface GrammarConceptInput {
    id: string;
    name: string;
    category: string;
    cefrLevelIntroduced: string;
    explanation: string;
    examples: GrammarConceptExample[];
}
