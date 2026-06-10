import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetPracticeSession } from "../../../src/dlg/practiceSessions/GetPracticeSession";
import { Exercise } from "../../../src/model/Exercise";

function makeExerciseBSON(id: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer: `answer-${id}`,
        vocabularyItemId: "vocab-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeSessionBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    };
}

function makeMockConfig(sessionDoc: any | null, exerciseDocs: any[] = []) {

    const collections: Record<string, any> = {
        practiceSessions: {
            findOne: async (_filter: any) => sessionDoc,
        },
        exercises: {
            find: (filter: any) => ({
                toArray: async () => {
                    const ids: string[] = filter?.id?.$in ?? [];
                    return exerciseDocs.filter(doc => ids.includes(doc.id));
                },
            }),
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

describe("GetPracticeSession.do", () => {

    it("returns the session state with full exercise objects when found and owned by the user", async () => {

        const oid = new ObjectId();
        const exerciseDocs = [makeExerciseBSON("ex-1"), makeExerciseBSON("ex-2")];
        const config = makeMockConfig(makeSessionBSON(oid), exerciseDocs);
        const delegate = new GetPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        assert.equal(result.sessionId, oid.toString());
        assert.equal(result.userId, "user-1");
        assert.equal(result.moduleId, "mod-1");
        assert.equal(result.currentPosition, 0);
        assert.deepEqual(result.retryQueue, []);
        assert.isNull(result.completedAt);
        assert.isArray(result.exercises);
        assert.lengthOf(result.exercises, 2);
    });

    it("embeds full exercise objects (id, type, prompt, answer) in the exercises field", async () => {

        const oid = new ObjectId();
        const exerciseDocs = [makeExerciseBSON("ex-1"), makeExerciseBSON("ex-2")];
        const config = makeMockConfig(makeSessionBSON(oid), exerciseDocs);
        const delegate = new GetPracticeSession({} as any, config);

        const result = await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);

        for (const ex of result.exercises) {
            assert.isString(ex.id, "exercise must have an id");
            assert.isString(ex.type, "exercise must have a type");
            assert.isString(ex.prompt, "exercise must have a prompt");
            assert.isString(ex.answer, "exercise must have an answer");
        }
    });

    it("throws 404 when the session does not exist", async () => {

        const config = makeMockConfig(null);
        const delegate = new GetPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: new ObjectId().toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 404 error");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 403 when the session belongs to a different user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeSessionBSON(oid, { userId: "user-2" }));
        const delegate = new GetPracticeSession({} as any, config);

        try {

            await delegate.do({ userId: "user-1", sessionId: oid.toString() }, { userId: "user-1" } as any);
            assert.fail("Expected 403 error");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });
});
