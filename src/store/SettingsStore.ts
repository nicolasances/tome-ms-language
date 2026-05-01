import { Db } from "mongodb";
import { ControllerConfig } from "../Config";
import { PracticeSettings, PracticeType, VocabularyPracticeConfig } from "../model/PracticeSettings";

const SETTINGS_COLLECTION = "settings";

const DEFAULTS: Record<PracticeType, VocabularyPracticeConfig> = {
    vocabulary: { wordCount: 10, defaultFailureRatio: 0.5 },
};

export class SettingsStore {

    private db: Db;
    private config: ControllerConfig;

    constructor({ db, config }: { db: Db; config: ControllerConfig }) {
        this.db = db;
        this.config = config;
    }

    async findByPracticeType({ practiceType }: { practiceType: PracticeType }): Promise<PracticeSettings | null> {
        const doc = await this.db.collection(SETTINGS_COLLECTION).findOne({ practiceType });
        if (!doc) return null;
        return PracticeSettings.fromBSON(doc);
    }

    /**
     * Returns the settings for the given practice type.
     * If no settings document is found, returns a PracticeSettings instance
     * built from hardcoded defaults so callers always get a valid object.
     */
    async getOrDefault({ practiceType }: { practiceType: PracticeType }): Promise<PracticeSettings> {
        const stored = await this.findByPracticeType({ practiceType });
        if (stored) return stored;

        return new PracticeSettings({ practiceType, config: DEFAULTS[practiceType] });
    }
}
