import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseResult } from "../../model/ExerciseResult";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

export class PostApplyVocabularyResults extends TotoDelegate<PostApplyVocabularyResultsRequest, PostApplyVocabularyResultsResponse> {

    parseRequest(req: Request): PostApplyVocabularyResultsRequest {

        const userId = req.params.userId;
        if (!userId) throw new ValidationError(400, "userId is required");

        const { results } = req.body ?? {};
        if (!results || !Array.isArray(results) || results.length === 0) throw new ValidationError(400, "results must be a non-empty array");

        const parsed: ApplyVocabularyResultEntry[] = results.map((entry: any, index: number) => {
            if (!entry.vocabularyItemId) throw new ValidationError(400, `results[${index}].vocabularyItemId is required`);

            const r = entry.result ?? {};
            if (!r.exerciseId) throw new ValidationError(400, `results[${index}].result.exerciseId is required`);
            if (!r.type) throw new ValidationError(400, `results[${index}].result.type is required`);
            if (r.isCorrect === undefined || r.isCorrect === null || typeof r.isCorrect !== "boolean") throw new ValidationError(400, `results[${index}].result.isCorrect is required`);
            if (r.userAnswer === undefined || r.userAnswer === null) throw new ValidationError(400, `results[${index}].result.userAnswer is required`);
            if (r.correctAnswer === undefined || r.correctAnswer === null) throw new ValidationError(400, `results[${index}].result.correctAnswer is required`);
            if (!r.timestamp) throw new ValidationError(400, `results[${index}].result.timestamp is required`);

            return {
                vocabularyItemId: entry.vocabularyItemId,
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

    async do(req: PostApplyVocabularyResultsRequest, _userContext?: UserContext): Promise<PostApplyVocabularyResultsResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());
        const store = new UserVocabularyProgressStore({ db, config });

        const updated: UpdatedItem[] = [];

        for (const entry of req.results) {
            const progress = await store.appendResultAndRecompute(req.userId, entry.vocabularyItemId, entry.result);
            updated.push({
                vocabularyItemId: progress.vocabularyItemId,
                masteryScore: progress.masteryScore,
                lastReviewed: progress.lastReviewed,
            });
        }

        return { updated };
    }
}

interface ApplyVocabularyResultEntry {
    vocabularyItemId: string;
    result: ExerciseResult;
}

interface UpdatedItem {
    vocabularyItemId: string;
    masteryScore: number;
    lastReviewed: string | null;
}

interface PostApplyVocabularyResultsRequest {
    userId: string;
    results: ApplyVocabularyResultEntry[];
}

interface PostApplyVocabularyResultsResponse {
    updated: UpdatedItem[];
}
