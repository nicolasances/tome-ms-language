import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { Sentence } from "../model/Sentence";
import { SentenceStore } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

export class PostSentences extends TotoDelegate<PostSentencesRequest, PostSentencesResponse> {

    parseRequest(req: Request): PostSentencesRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }

        const sentences = req.body.sentences;
        if (!sentences || !Array.isArray(sentences) || sentences.length === 0) {
            throw new ValidationError(400, "No sentences provided");
        }

        return { language, sentences };
    }

    async do(req: PostSentencesRequest, userContext?: UserContext): Promise<PostSentencesResponse> {
        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new SentenceStore(db, config);

        const results: PostSentencesResponse["results"] = [];

        for (const item of req.sentences) {
            const missing: string[] = [];
            if (!item.sentence) missing.push("sentence");
            if (!item.translation) missing.push("translation");
            if (!item.knowledgeSource) missing.push("knowledgeSource");

            if (missing.length > 0) {
                results.push({ sentence: item.sentence ?? "", status: "error", reason: "missing_field" });
                continue;
            }

            try {
                const sentenceDoc = new Sentence({
                    language: req.language,
                    sentence: item.sentence!,
                    translation: item.translation!,
                    createdAt: new Date().toISOString(),
                    knowledgeSource: item.knowledgeSource!,
                });
                const id = await store.insertSentence(sentenceDoc);
                results.push({ sentence: item.sentence!, status: "created", id });
            } catch {
                results.push({ sentence: item.sentence ?? "", status: "error", reason: "insert_failed" });
            }
        }

        return { results };
    }
}

interface PostSentencesRequest {
    language: string;
    sentences: Array<{ sentence?: string; translation?: string; knowledgeSource?: string }>;
}

interface PostSentencesResponse {
    results: Array<{ sentence: string; status: string; id?: string; reason?: string }>;
}

