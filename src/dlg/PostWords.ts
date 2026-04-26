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
        const validWords: Word[] = [];
        const validWordIndexes: number[] = [];
        const validEnglishValues: string[] = [];

        for (const [index, item] of req.words.entries()) {
            if (!item.english || !item.translation) {
                results[index] = { english: item.english ?? "", status: "error", reason: "missing_field" };
                continue;
            }

            validWords.push(new Word(req.language, item.english, item.translation, new Date().toISOString(), undefined, item.knowledgeSource));
            validWordIndexes.push(index);
            validEnglishValues.push(item.english);
        }

        const ids = await store.insertWords(validWords);

        for (let i = 0; i < ids.length; i++) {
            results[validWordIndexes[i]] = { english: validEnglishValues[i], status: "created", id: ids[i] };
        }

        return { results };
    }
}

interface PostWordsRequest {
    language: string;
    words: Array<{ english?: string; translation?: string; knowledgeSource?: string }>;
}

interface PostWordsResponse {
    results: Array<
        | { english: string; status: "created"; id: string }
        | { english: string; status: "error"; reason: string }
    >;
}
