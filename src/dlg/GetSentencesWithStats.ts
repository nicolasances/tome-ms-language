import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../Config";
import { SentenceStore, SentenceWithStats } from "../store/SentenceStore";
import { SUPPORTED_LANGUAGES } from "../util/Languages";

const DEFAULT_PAGE_SIZE = 100;

export class GetSentencesWithStats extends TotoDelegate<GetSentencesWithStatsRequest, GetSentencesWithStatsResponse> {

    parseRequest(req: Request): GetSentencesWithStatsRequest {
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

        const sortByParam = req.query.sortBy as string | undefined;
        const sortDirParam = req.query.sortDir as string | undefined;

        const VALID_SORT_BY = ["difficulty"];
        const VALID_SORT_DIR = ["asc", "desc"];

        if (sortByParam !== undefined && !VALID_SORT_BY.includes(sortByParam)) {
            throw new ValidationError(400, `Invalid sortBy value: "${sortByParam}". Accepted values: ${VALID_SORT_BY.join(", ")}`);
        }

        if (sortDirParam !== undefined && !VALID_SORT_DIR.includes(sortDirParam)) {
            throw new ValidationError(400, `Invalid sortDir value: "${sortDirParam}". Accepted values: ${VALID_SORT_DIR.join(", ")}`);
        }

        const sortBy = sortByParam as "difficulty" | undefined;
        const sortDir = sortDirParam as "asc" | "desc" | undefined;

        return { language, page, pageSize, sortBy, sortDir };
    }

    async do(req: GetSentencesWithStatsRequest, userContext?: UserContext): Promise<GetSentencesWithStatsResponse> {
        if (!userContext?.email) {
            throw new ValidationError(401, "Unauthorized: user context required");
        }

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const store = new SentenceStore(db, config);
        const result = await store.findByLanguageWithStats({
            language: req.language,
            userId: userContext.email,
            page: req.page,
            pageSize: req.pageSize,
            sortBy: req.sortBy,
            sortDir: req.sortDir,
        });

        return {
            language: req.language,
            page: req.page,
            pageSize: req.pageSize,
            totalCount: result.totalCount,
            sentences: result.sentences
        };
    }
}

interface GetSentencesWithStatsRequest {
    language: string;
    page: number;
    pageSize: number;
    sortBy?: "difficulty";
    sortDir?: "asc" | "desc";
}

interface GetSentencesWithStatsResponse {
    language: string;
    page: number;
    pageSize: number;
    totalCount: number;
    sentences: SentenceWithStats[];
}
