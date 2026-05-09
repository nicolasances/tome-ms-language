import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Word } from "../model/Word";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class SampleWords extends TotoDelegate<SampleWordsRequest, SampleWordsResponse> {

    parseRequest(req: Request): SampleWordsRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }

        const nParam = req.query.n;
        let n = 20;
        if (nParam !== undefined) {
            const parsed = Number(nParam);
            if (!Number.isInteger(parsed) || parsed <= 0) {
                throw new ValidationError(400, `Invalid 'n' parameter: must be a positive integer`);
            }
            n = parsed;
        }

        return { language, n };
    }

    async do(req: SampleWordsRequest, userContext?: UserContext): Promise<SampleWordsResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new SentenceStore(db, config);

        const raw = await store.sampleWords(req.language, req.n);

        return {
            language: req.language,
            words: raw.map(doc => ({
                id: doc._id.toString(),
                english: doc.english,
                translation: doc.translation,
                createdAt: doc.createdAt,
                knowledgeSource: doc.knowledgeSource,
            })),
        };
    }
}

interface SampleWordsRequest {
    language: string;
    n: number;
}

interface SampleWordsResponse {
    language: string;
    words: Array<{
        id: string;
        english: string;
        translation: string;
        createdAt: string;
        knowledgeSource: string;
    }>;
}
