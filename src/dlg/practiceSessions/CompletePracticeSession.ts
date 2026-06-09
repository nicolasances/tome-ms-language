import { Request } from "express";
import { TotoDelegate, UserContext, ValidationError } from "totoms";
import { ControllerConfig } from "../../Config";
import { ExerciseResult } from "../../model/ExerciseResult";
import { ExerciseStore } from "../../store/ExerciseStore";
import { ModuleStore } from "../../store/ModuleStore";
import { PracticeSessionStore } from "../../store/PracticeSessionStore";
import { UserGrammarConceptProgressStore } from "../../store/UserGrammarConceptProgressStore";
import { UserModuleProgressStore } from "../../store/UserModuleProgressStore";
import { UserVocabularyProgressStore } from "../../store/UserVocabularyProgressStore";

export class CompletePracticeSession extends TotoDelegate<CompletePracticeSessionRequest, CompletePracticeSessionResponse> {

    parseRequest(req: Request): CompletePracticeSessionRequest {

        const userId = req.params.userId;
        const sessionId = req.params.sessionId;

        if (!userId) throw new ValidationError(400, "userId is required");
        if (!sessionId) throw new ValidationError(400, "sessionId is required");

        return { userId, sessionId };
    }

    async do(req: CompletePracticeSessionRequest, userContext?: UserContext): Promise<CompletePracticeSessionResponse> {

        const config = this.config as ControllerConfig;
        const db = await config.getMongoDb(config.getDBName());

        const sessionStore = new PracticeSessionStore({ db, config });

        const session = await sessionStore.findById(req.sessionId);

        if (!session) throw new ValidationError(404, `Practice session ${req.sessionId} not found`);
        if (session.completedAt !== null) throw new ValidationError(400, "Session is already completed");

        const exerciseStore = new ExerciseStore(db);
        const vocabProgressStore = new UserVocabularyProgressStore({ db, config });
        const grammarProgressStore = new UserGrammarConceptProgressStore({ db, config });

        const now = new Date().toISOString();

        // Update mastery for every exercise attempted in the session
        for (const answer of session.answers) {

            const exercise = await exerciseStore.findById(answer.exerciseId);

            if (!exercise) continue;

            const result = new ExerciseResult({
                exerciseId: exercise.id,
                type: exercise.type,
                isCorrect: answer.isCorrect,
                userAnswer: answer.userAnswer,
                correctAnswer: exercise.answer,
                timestamp: answer.answeredAt,
                moduleId: session.moduleId,
            });

            if (exercise.vocabularyItemId) {
                await vocabProgressStore.appendResultAndRecompute(req.userId, exercise.vocabularyItemId, result);
            } else if (exercise.grammarConceptId) {
                await grammarProgressStore.appendResultAndRecompute(req.userId, exercise.grammarConceptId, result);
            }
        }

        // Collect the vocab item ids for all exercises attempted in the session
        const sessionVocabIds: string[] = [];

        for (const exerciseId of [...new Set(session.answers.map(a => a.exerciseId))]) {

            const exercise = await exerciseStore.findById(exerciseId);

            if (exercise?.vocabularyItemId) sessionVocabIds.push(exercise.vocabularyItemId);
        }

        // Append to UserModuleProgress.vocabularyItemsPracticed
        const userModuleProgressStore = new UserModuleProgressStore({ db, config });

        const updatedProgress = await userModuleProgressStore.appendPracticedVocabulary(req.userId, session.moduleId, sessionVocabIds);

        // Evaluate coverage gate
        const moduleStore = new ModuleStore(db);
        const module = await moduleStore.findById(session.moduleId);

        let step2Complete = false;
        let unseenVocabCount = 0;

        if (module) {

            const practicedSet = new Set(updatedProgress?.vocabularyItemsPracticed ?? []);
            const allVocabIds = module.vocabularyItemIds;
            const uncoveredIds = allVocabIds.filter(id => !practicedSet.has(id));

            step2Complete = uncoveredIds.length === 0;
            unseenVocabCount = uncoveredIds.length;

            if (step2Complete) {
                await userModuleProgressStore.transitionStatus(req.userId, session.moduleId, "in_progress", now);
            }
        }

        // Mark session complete
        await sessionStore.complete(req.sessionId, now);

        return { step2Complete, unseenVocabCount };
    }
}

interface CompletePracticeSessionRequest {
    userId: string;
    sessionId: string;
}

interface CompletePracticeSessionResponse {
    step2Complete: boolean;
    unseenVocabCount: number;
}
