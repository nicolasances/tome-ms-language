import { WithId } from "mongodb";

export type PracticeType = "vocabulary" | "sentences";

export interface VocabularyPracticeConfig {
    wordCount: number;
    defaultFailureRatio: number;
}

export interface SentencePracticeConfig {
    sentenceCount: number;
    defaultFailureRatio: number;
}

export type PracticeConfig = VocabularyPracticeConfig | SentencePracticeConfig;

export class PracticeSettings {

    practiceType: PracticeType;
    config: PracticeConfig;

    constructor({ practiceType, config }: { practiceType: PracticeType; config: PracticeConfig }) {
        this.practiceType = practiceType;
        this.config = config;
    }

    static fromBSON(data: WithId<any>): PracticeSettings {
        const { practiceType, config } = data;

        if (!practiceType) throw new Error("PracticeSettings: missing practiceType");
        if (!config || typeof config !== "object") throw new Error("PracticeSettings: missing config");

        if (practiceType === "vocabulary") {
            const wordCount = config.wordCount;
            const defaultFailureRatio = config.defaultFailureRatio;

            if (typeof wordCount !== "number" || !Number.isInteger(wordCount) || wordCount <= 0) {
                throw new Error(`PracticeSettings: invalid wordCount: ${wordCount}`);
            }
            if (typeof defaultFailureRatio !== "number" || !isFinite(defaultFailureRatio) || defaultFailureRatio < 0 || defaultFailureRatio > 1) {
                throw new Error(`PracticeSettings: invalid defaultFailureRatio: ${defaultFailureRatio}`);
            }

            return new PracticeSettings({ practiceType, config: { wordCount, defaultFailureRatio } });
        }

        if (practiceType === "sentences") {
            const sentenceCount = config.sentenceCount;
            const defaultFailureRatio = config.defaultFailureRatio;

            if (typeof sentenceCount !== "number" || !Number.isInteger(sentenceCount) || sentenceCount <= 0) {
                throw new Error(`PracticeSettings: invalid sentenceCount: ${sentenceCount}`);
            }
            if (typeof defaultFailureRatio !== "number" || !isFinite(defaultFailureRatio) || defaultFailureRatio < 0 || defaultFailureRatio > 1) {
                throw new Error(`PracticeSettings: invalid defaultFailureRatio: ${defaultFailureRatio}`);
            }

            return new PracticeSettings({ practiceType, config: { sentenceCount, defaultFailureRatio } });
        }

        throw new Error(`PracticeSettings: unsupported practiceType: ${practiceType}`);
    }

    toBSON(): any {
        return { practiceType: this.practiceType, config: this.config };
    }
}
