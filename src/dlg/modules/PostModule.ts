import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { CEFR_LEVELS, Module } from "../../model/Module";
import { GrammarConceptStore } from "../../store/GrammarConceptStore";
import { ModuleStore } from "../../store/ModuleStore";
import { VocabularyItemStore } from "../../store/VocabularyItemStore";

export class PostModule extends TotoDelegate<PostModuleRequest, PostModuleResponse> {

    parseRequest(req: Request): PostModuleRequest {

        const { id, title, theme, communicationGoal, cefrLevel, vocabularyItemIds, grammarConceptIds, isUserGenerated, createdByUserId, practiceSessionSize, testUnlockDelayHours, testRetryDelayMinutes, testFreshExercisePercent, testPassThreshold } = req.body ?? {};

        if (!id) throw new ValidationError(400, "id is required");
        if (!title) throw new ValidationError(400, "title is required");
        if (!theme) throw new ValidationError(400, "theme is required");
        if (!communicationGoal) throw new ValidationError(400, "communicationGoal is required");
        if (!cefrLevel || !(CEFR_LEVELS as readonly string[]).includes(cefrLevel)) throw new ValidationError(400, `cefrLevel must be one of: ${CEFR_LEVELS.join(", ")}`);

        return {
            id,
            title,
            theme,
            communicationGoal,
            cefrLevel,
            vocabularyItemIds: Array.isArray(vocabularyItemIds) ? vocabularyItemIds : [],
            grammarConceptIds: Array.isArray(grammarConceptIds) ? grammarConceptIds : [],
            isUserGenerated: isUserGenerated ?? false,
            createdByUserId,
            practiceSessionSize: practiceSessionSize ?? 15,
            testUnlockDelayHours: testUnlockDelayHours ?? 4,
            testRetryDelayMinutes: testRetryDelayMinutes ?? 20,
            testFreshExercisePercent: testFreshExercisePercent ?? 50,
            testPassThreshold: testPassThreshold ?? 80,
        };
    }

    async do(req: PostModuleRequest, _userContext?: UserContext): Promise<PostModuleResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        if (req.vocabularyItemIds.length > 0) {

            const vocabStore = new VocabularyItemStore(db);
            const found = await vocabStore.findByIds(req.vocabularyItemIds);

            if (found.length !== req.vocabularyItemIds.length) throw new ValidationError(400, "One or more vocabularyItemIds do not exist");
        }

        if (req.grammarConceptIds.length > 0) {

            const grammarStore = new GrammarConceptStore(db);
            const found = await grammarStore.findByIds(req.grammarConceptIds);

            if (found.length !== req.grammarConceptIds.length) throw new ValidationError(400, "One or more grammarConceptIds do not exist");
        }

        const store = new ModuleStore(db);
        const module = new Module(req);

        const result = await store.insertOne(module);

        if (result.status === "duplicate_id") throw new ValidationError(409, `Module with id '${req.id}' already exists`);

        return { id: result.module.id };
    }
}

interface PostModuleRequest {
    id: string;
    title: string;
    theme: string;
    communicationGoal: string;
    cefrLevel: string;
    vocabularyItemIds: string[];
    grammarConceptIds: string[];
    isUserGenerated: boolean;
    createdByUserId?: string;
    practiceSessionSize: number;
    testUnlockDelayHours: number;
    testRetryDelayMinutes: number;
    testFreshExercisePercent: number;
    testPassThreshold: number;
}

interface PostModuleResponse {
    id: string;
}

