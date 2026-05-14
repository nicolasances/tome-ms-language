import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { VocabularyStore, WordWithStats } from "../store/VocabularyStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

const DEFAULT_PAGE_SIZE = 100;

export class GetVocabularyWithStats extends TotoDelegate<GetVocabularyWithStatsRequest, GetVocabularyWithStatsResponse> {

    parseRequest(req: Request): GetVocabularyWithStatsRequest {
        const language = req.params.language;
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            throw new ValidationError(400, `Unsupported language: ${language}`);
        }

        const pageParam = req.query.page;
        const pageSizeParam = req.query.pageSize;

        let page = 1;
        if (pageParam !== undefined) {
            page = parseInt(pageParam as string, 10);
            if (isNaN(page) || page < 1) {
                throw new ValidationError(400, "page must be a positive integer");
            }
        }

        let pageSize = DEFAULT_PAGE_SIZE;
        if (pageSizeParam !== undefined) {
            pageSize = parseInt(pageSizeParam as string, 10);
            if (isNaN(pageSize) || pageSize < 1) {
                throw new ValidationError(400, "pageSize must be a positive integer");
            }
        }

        return { language, page, pageSize };
    }

    async do(req: GetVocabularyWithStatsRequest, userContext?: UserContext): Promise<GetVocabularyWithStatsResponse> {
        if (!userContext?.email) {
            throw new ValidationError(401, "Unauthorized: user context required");
        }

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new VocabularyStore(db, config);
        const result = await store.findByLanguageWithStats({
            language: req.language,
            userId: userContext.email,
            page: req.page,
            pageSize: req.pageSize
        });

        return {
            language: req.language,
            page: req.page,
            pageSize: req.pageSize,
            totalCount: result.totalCount,
            words: result.words
        };
    }
}

interface GetVocabularyWithStatsRequest {
    language: string;
    page: number;
    pageSize: number;
}

interface GetVocabularyWithStatsResponse {
    language: string;
    page: number;
    pageSize: number;
    totalCount: number;
    words: WordWithStats[];
}
