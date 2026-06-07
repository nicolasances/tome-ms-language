import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseResult } from "../../model/ExerciseResult";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";

export class PostApplyGrammarResults extends TotoDelegate<PostApplyGrammarResultsRequest, PostApplyGrammarResultsResponse> {

    parseRequest(req: Request): PostApplyGrammarResultsRequest {

        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");

        const { results } = req.body ?? {};
        if (!results || !Array.isArray(results) || results.length === 0) throw new ValidationError(400, "results must be a non-empty array");

        const parsed: ApplyGrammarResultEntry[] = results.map((entry: any, index: number) => {
            if (!entry.grammarConceptId) throw new ValidationError(400, `results[${index}].grammarConceptId is required`);

            const r = entry.result ?? {};
            if (!r.exerciseId) throw new ValidationError(400, `results[${index}].result.exerciseId is required`);
            if (!r.type) throw new ValidationError(400, `results[${index}].result.type is required`);
            if (r.isCorrect === undefined || r.isCorrect === null || typeof r.isCorrect !== "boolean") throw new ValidationError(400, `results[${index}].result.isCorrect is required`);
            if (r.userAnswer === undefined || r.userAnswer === null) throw new ValidationError(400, `results[${index}].result.userAnswer is required`);
            if (r.correctAnswer === undefined || r.correctAnswer === null) throw new ValidationError(400, `results[${index}].result.correctAnswer is required`);
            if (!r.timestamp) throw new ValidationError(400, `results[${index}].result.timestamp is required`);

            return {
                grammarConceptId: entry.grammarConceptId,
                result: new ExerciseResult({
                    exerciseId: r.exerciseId,
                    type: r.type,
                    isCorrect: r.isCorrect,
                    userAnswer: r.userAnswer,
                    correctAnswer: r.correctAnswer,
                    timestamp: r.timestamp,
                    moduleId: r.moduleId ?? null,
                }),
            };
        });

        return { userId, results: parsed };
    }

    async do(req: PostApplyGrammarResultsRequest, _userContext?: UserContext): Promise<PostApplyGrammarResultsResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserGrammarConceptProgressStore({ db, config });

        const updated: UpdatedItem[] = [];

        for (const entry of req.results) {
            const progress = await store.appendResultAndRecompute(req.userId, entry.grammarConceptId, entry.result);
            updated.push({
                grammarConceptId: progress.grammarConceptId,
                masteryScore: progress.masteryScore,
                lastReviewed: progress.lastReviewed,
            });
        }

        return { updated };
    }
}

interface ApplyGrammarResultEntry {
    grammarConceptId: string;
    result: ExerciseResult;
}

interface UpdatedItem {
    grammarConceptId: string;
    masteryScore: number;
    lastReviewed: string | null;
}

interface PostApplyGrammarResultsRequest {
    userId: string;
    results: ApplyGrammarResultEntry[];
}

interface PostApplyGrammarResultsResponse {
    updated: UpdatedItem[];
}
