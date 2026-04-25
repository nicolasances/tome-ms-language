import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Word } from "../model/Word";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class PostWords extends TotoDelegate<PostWordsRequest, PostWordsResponse> {

    parseRequest(req: Request): PostWordsRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        const words = req.body.words;
        if (!words || !Array.isArray(words) || words.length === 0) {
            throw new ValidationError(400, "No words provided");
        }
        return { language, words };
    }

    async do(req: PostWordsRequest, userContext?: UserContext): Promise<PostWordsResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyStore(db, config);
        const results: PostWordsResponse["results"] = [];

        for (const item of req.words) {
            if (!item.english || !item.translation) {
                results.push({ english: item.english ?? "", status: "error", reason: "missing_field" });
                continue;
            }
            const word = new Word(req.language, item.english, item.translation, new Date().toISOString());
            const id = await store.insertWord(word);
            results.push({ english: item.english, status: "created", id });
        }

        return { results };
    }
}

interface PostWordsRequest {
    language: string;
    words: Array<{ english?: string; translation?: string }>;
}

interface PostWordsResponse {
    results: Array<
        | { english: string; status: "created"; id: string }
        | { english: string; status: "error"; reason: string }
    >;
}
