import { WithId } from "mongodb";
import { MODULE_TEST_SIZE } from "../Config";
import { CEFR_LEVELS } from "./CefrLevels";

export { CEFR_LEVELS };

export class Module {

    id: string;
    title: string;
    theme: string;
    communicationGoal: string;
    cefrLevel: string;
    vocabularyItemIds: string[];
    grammarConceptIds: string[];
    createdAt: Date;
    isUserGenerated: boolean;
    createdByUserId?: string;
    practiceSessionSize: number;
    testUnlockDelayHours: number;
    testRetryDelayMinutes: number;
    testPassThreshold: number;
    testQuestionCount: number;          // Number of questions drawn for a module test; defaults to MODULE_TEST_SIZE

    constructor(input: ModuleInput) {

        this.id = input.id;
        this.title = input.title;
        this.theme = input.theme;
        this.communicationGoal = input.communicationGoal;
        this.cefrLevel = input.cefrLevel;
        this.vocabularyItemIds = input.vocabularyItemIds ?? [];
        this.grammarConceptIds = input.grammarConceptIds ?? [];
        this.createdAt = input.createdAt ?? new Date();
        this.isUserGenerated = input.isUserGenerated ?? false;
        this.createdByUserId = input.createdByUserId;
        this.practiceSessionSize = input.practiceSessionSize ?? 20;
        this.testUnlockDelayHours = input.testUnlockDelayHours ?? 4;
        this.testRetryDelayMinutes = input.testRetryDelayMinutes ?? 20;
        this.testPassThreshold = input.testPassThreshold ?? 80;
        this.testQuestionCount = input.testQuestionCount ?? MODULE_TEST_SIZE;
    }

    /**
     * Creates a Module instance from a MongoDB BSON document.
     */
    static fromBSON(data: WithId<any>): Module {

        return new Module({
            id: data.id,
            title: data.title,
            theme: data.theme,
            communicationGoal: data.communicationGoal,
            cefrLevel: data.cefrLevel,
            vocabularyItemIds: data.vocabularyItemIds ?? [],
            grammarConceptIds: data.grammarConceptIds ?? [],
            createdAt: data.createdAt,
            isUserGenerated: data.isUserGenerated ?? false,
            createdByUserId: data.createdByUserId,
            practiceSessionSize: data.practiceSessionSize ?? 20,
            testUnlockDelayHours: data.testUnlockDelayHours ?? 4,
            testRetryDelayMinutes: data.testRetryDelayMinutes ?? 20,
            testPassThreshold: data.testPassThreshold ?? 80,
            testQuestionCount: data.testQuestionCount ?? MODULE_TEST_SIZE,
        });
    }

    /**
     * Serializes the Module to a MongoDB BSON document.
     */
    toBSON(): any {

        return {
            id: this.id,
            title: this.title,
            theme: this.theme,
            communicationGoal: this.communicationGoal,
            cefrLevel: this.cefrLevel,
            vocabularyItemIds: this.vocabularyItemIds,
            grammarConceptIds: this.grammarConceptIds,
            createdAt: this.createdAt,
            isUserGenerated: this.isUserGenerated,
            createdByUserId: this.createdByUserId,
            practiceSessionSize: this.practiceSessionSize,
            testUnlockDelayHours: this.testUnlockDelayHours,
            testRetryDelayMinutes: this.testRetryDelayMinutes,
            testPassThreshold: this.testPassThreshold,
            testQuestionCount: this.testQuestionCount,
        };
    }
}

export interface ModuleInput {
    id: string;
    title: string;
    theme: string;
    communicationGoal: string;
    cefrLevel: string;
    vocabularyItemIds?: string[];
    grammarConceptIds?: string[];
    createdAt?: Date;
    isUserGenerated?: boolean;
    createdByUserId?: string;
    practiceSessionSize?: number;
    testUnlockDelayHours?: number;
    testRetryDelayMinutes?: number;
    testPassThreshold?: number;
    testQuestionCount?: number;         // Number of questions drawn for a module test; defaults to MODULE_TEST_SIZE
}
