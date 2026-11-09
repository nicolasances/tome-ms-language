import { ModuleStore } from "../store/ModuleStore";
import { UserModuleProgressStore } from "../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../store/UserVocabularyProgressStore";
import { VocabularyItemStore } from "../store/VocabularyItemStore";
import { buildWordGroups, WordGroup } from "./WordsPracticePool";

export interface WordsPoolLoaderInput {
    moduleProgressStore: UserModuleProgressStore;       // Source of the user's completed modules.
    moduleStore: ModuleStore;                           // Source of the modules' vocabulary item ids.
    vocabularyStore: VocabularyItemStore;               // Source of the vocabulary items.
    vocabularyProgressStore: UserVocabularyProgressStore; // Source of the user's mastery / lastReviewed.
}

/**
 * Builds the Words Practice word pool (F26) for a user, with a fixed number of store reads
 * regardless of pool size.
 */
export class WordsPoolLoader {

    private moduleProgressStore: UserModuleProgressStore;
    private moduleStore: ModuleStore;
    private vocabularyStore: VocabularyItemStore;
    private vocabularyProgressStore: UserVocabularyProgressStore;

    constructor({ moduleProgressStore, moduleStore, vocabularyStore, vocabularyProgressStore }: WordsPoolLoaderInput) {
        this.moduleProgressStore = moduleProgressStore;
        this.moduleStore = moduleStore;
        this.vocabularyStore = vocabularyStore;
        this.vocabularyProgressStore = vocabularyProgressStore;
    }

    /**
     * Loads the user's word pool: the curriculum vocabulary of every `completed` module at any
     * level, deduplicated into practice words by normalized Danish form. Modules that are not
     * completed (including ones reset for re-practice, F25) and user-added items contribute nothing.
     *
     * @param {string} userId - The user whose pool is built.
     *
     * @returns {Promise<WordGroup[]>} One group per practice word; empty when no module is completed.
     */
    async load(userId: string): Promise<WordGroup[]> {

        const allProgress = await this.moduleProgressStore.listByUser(userId);
        const completedModuleIds = allProgress.filter(p => p.status === "completed").map(p => p.moduleId);

        if (completedModuleIds.length === 0) return [];

        const completedModules = await this.moduleStore.findByIds(completedModuleIds);
        
        const itemIds = [...new Set(completedModules.flatMap(m => m.vocabularyItemIds))];

        if (itemIds.length === 0) return [];

        const allItems = await this.vocabularyStore.findByIds(itemIds);
        const items = allItems.filter(item => item.source === "curriculum");
        const progress = await this.vocabularyProgressStore.listByUser(userId, items.map(i => i.id));

        return buildWordGroups({ items, progress });
    }
}
