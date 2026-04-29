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

        // Validate that all words have required fields
        for (const [index, word] of words.entries()) {
            const missingFields: string[] = [];
            if (!word.english) missingFields.push("english");
            if (!word.translation) missingFields.push("translation");
            if (!word.knowledgeSource) missingFields.push("knowledgeSource");
            
            if (missingFields.length > 0) {
                throw new ValidationError(400, `Word at index ${index} is missing required fields: ${missingFields.join(", ")}`);
            }
        }
     
        return { language, words };
    }

    async do(req: PostWordsRequest, userContext?: UserContext): Promise<PostWordsResponse> {
     
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyStore(db, config);
     
        const results: PostWordsResponse["results"] = [];
     
        const validWords: Word[] = [];

        for (const [index, item] of req.words.entries()) {
            validWords.push(new Word({ language: req.language, english: item.english!, translation: item.translation!, createdAt: new Date().toISOString(), id: undefined, knowledgeSource: item.knowledgeSource! }));
        }

        const ids = await store.insertWords(validWords);

        for (let i = 0; i < ids.length; i++) {
            results[i] = { english: validWords[i].english, status: "created", id: ids[i] };
        }

        return { results };
    }
}

interface PostWordsRequest {
    language: string;
    words: Array<{ english?: string; translation?: string; knowledgeSource?: string }>;
}

interface PostWordsResponse {
    results: Array<{ english: string; status: "created"; id: string }>;
}
