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

        // Validate each item first; collect valid sentences for the batch upsert
        const validSentences: Array<{ index: number; sentence: Sentence }> = [];

        for (let i = 0; i < req.sentences.length; i++) {
            const item = req.sentences[i];
            const missing: string[] = [];
            if (!item.sentence) missing.push("sentence");
            if (!item.translation) missing.push("translation");
            if (!item.knowledgeSource) missing.push("knowledgeSource");

            if (missing.length > 0) {
                results.push({ sentence: item.sentence ?? "", status: "error", reason: "missing_field" });
                continue;
            }

            validSentences.push({
                index: i,
                sentence: new Sentence({
                    language: req.language,
                    sentence: item.sentence!,
                    translation: item.translation!,
                    createdAt: new Date().toISOString(),
                    knowledgeSource: item.knowledgeSource!,
                }),
            });
            // placeholder — will be replaced after the batch call
            results.push({ sentence: item.sentence!, status: "pending" });
        }

        if (validSentences.length > 0) {
            try {
                const ids = await store.insertSentences(validSentences.map(v => v.sentence));
                for (let j = 0; j < validSentences.length; j++) {
                    const { index } = validSentences[j];
                    results[index] = { sentence: req.sentences[index].sentence!, status: "created", id: ids[j] };
                }
            } catch {
                for (const { index } of validSentences) {
                    results[index] = { sentence: req.sentences[index].sentence ?? "", status: "error", reason: "insert_failed" };
                }
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

