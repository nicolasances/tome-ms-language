import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Sentence } from "../model/Sentence";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class PostSentence extends TotoDelegate<PostSentenceRequest, PostSentenceResponse> {

    parseRequest(req: Request): PostSentenceRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }

        const { sentence, translation, knowledgeSource } = req.body;
        const missing: string[] = [];
        if (!sentence) missing.push("sentence");
        if (!translation) missing.push("translation");
        if (!knowledgeSource) missing.push("knowledgeSource");
        if (missing.length > 0) {
            throw new ValidationError(400, `Missing required fields: ${missing.join(", ")}`);
        }

        return { language, sentence, translation, knowledgeSource };
    }

    async do(req: PostSentenceRequest, userContext?: UserContext): Promise<PostSentenceResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new SentenceStore(db, config);

        const sentence = new Sentence({
            language: req.language,
            sentence: req.sentence,
            translation: req.translation,
            createdAt: new Date().toISOString(),
            knowledgeSource: req.knowledgeSource,
        });

        const id = await store.insertSentence(sentence);
        return { id };
    }
}

interface PostSentenceRequest {
    language: string;
    sentence: string;
    translation: string;
    knowledgeSource: string;
}

interface PostSentenceResponse {
    id: string;
}
