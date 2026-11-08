import { FakeDb } from "../../helpers/FakeDb";

export const USER = { id: "u1", email: "u1@u1.com" };
export const userContext = { email: USER.email, authProvider: "test", userId: "SHOULD-NOT-BE-USED" };

export function vocabDoc(id: string, danish: string, overrides: any = {}): any {
    return { id, danish, english: `en-${id}`, type: "noun", context: null, tags: [], cefrLevel: "A1", source: "curriculum", addedByUserId: null, ...overrides };
}

export function moduleDoc(id: string, vocabularyItemIds: string[], cefrLevel = "A1"): any {
    return { id, title: id, theme: "t", communicationGoal: "g", cefrLevel, vocabularyItemIds, grammarConceptIds: [] };
}

export function moduleProgressDoc(moduleId: string, status: string, userId = USER.id): any {
    return { userId, moduleId, status, startedAt: null, completedAt: null, testAttempts: [] };
}

export function vocabProgressDoc(vocabularyItemId: string, masteryScore: number, lastReviewed: string | null = null, userId = USER.id): any {
    return { userId, vocabularyItemId, masteryScore, lastReviewed, exerciseHistory: [] };
}

export function makeConfig(db: FakeDb): any {
    return { getMongoDb: async () => db, getDBName: () => "tomelang" };
}

export function makeDb(extra: Record<string, any[]> = {}): FakeDb {
    return new FakeDb({ users: [USER], ...extra });
}
