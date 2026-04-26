import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Word } from "../model/Word";
import { VocabularyStore } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class PostWord extends TotoDelegate<PostWordRequest, PostWordResponse> {

    parseRequest(req: Request): PostWordRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }
        if (!req.body.english) throw new ValidationError(400, "No english word provided");
        if (!req.body.translation) throw new ValidationError(400, "No translation provided");
        if (!req.body.knowledgeSource) throw new ValidationError(400, "No knowledgeSource provided");
        return { language, english: req.body.english, translation: req.body.translation, knowledgeSource: req.body.knowledgeSource };
    }

    async do(req: PostWordRequest, userContext?: UserContext): Promise<PostWordResponse> {
        
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const word = new Word(req.language, req.english, req.translation, new Date().toISOString(), undefined, req.knowledgeSource);

        const store = new VocabularyStore(db, config);
        
        const id = await store.insertWord(word);

        return { id };
    }
}

interface PostWordRequest {
    language: string;
    english: string;
    translation: string;
    knowledgeSource: string;
}

interface PostWordResponse {
    id: string;
}
