import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetLevelTestReview } from "../../../src/dlg/levelTests/GetLevelTestReview";
import { Exercise } from "../../../src/model/Exercise";

function makeVocabExercise(id: string, vocabId: string): any {
    return new Exercise({ id, moduleId: null, type: "translation_active", prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: vocabId, grammarConceptId: null }).toBSON();
}

function makeGrammarExercise(id: string, grammarId: string): any {
    return new Exercise({ id, moduleId: null, type: "sentence_reorder", prompt: `prompt-${id}`, answer: `answer-${id}`, vocabularyItemId: null, grammarConceptId: grammarId }).toBSON();
}

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1", "ex-2", "ex-3"],
        answers: [
            { exerciseId: "ex-1", isCorrect: true, userAnswer: "answer-ex-1", answeredAt: "2026-06-16T10:00:00.000Z" },
            { exerciseId: "ex-2", isCorrect: false, userAnswer: "oops", answeredAt: "2026-06-16T10:01:00.000Z" },
            { exerciseId: "ex-3", isCorrect: false, userAnswer: "nope", answeredAt: "2026-06-16T10:02:00.000Z" },
        ],
        currentPosition: 3,
        verifiedExerciseIds: [],
        score: 33,
        passed: false,
        startedAt: "2026-06-16T09:00:00.000Z",
        takenAt: "2026-06-16T10:05:00.000Z",
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[]) {

    const collections: Record<string, any> = {
        levelTestAttempts: { findOne: async (f: any) => (attemptDoc && attemptDoc._id.equals(f._id) ? attemptDoc : null) },
        exercises: { find: () => ({ toArray: async () => exerciseDocs }) },
    };

    return { getDBName: () => "test", getMongoDb: async () => ({ collection: (name: string) => collections[name] }) } as any;
}

describe("GetLevelTestReview.do", () => {

    it("returns the score, passed flag, and per-question review with correct answers", async () => {

        const oid = new ObjectId();
        const exercises = [makeVocabExercise("ex-1", "v-1"), makeVocabExercise("ex-2", "v-2"), makeGrammarExercise("ex-3", "g-1")];
        const config = makeMockConfig(makeAttemptBSON(oid), exercises);
        const delegate = new GetLevelTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 33);
        assert.isFalse(result.passed);
        assert.equal(result.questions.length, 3);
        assert.equal(result.questions[0].correctAnswer, "answer-ex-1");
        assert.equal(result.questions[1].userAnswer, "oops");
    });

    it("derives weak areas from incorrect answers grouped by vocabulary item and grammar concept", async () => {

        const oid = new ObjectId();
        const exercises = [makeVocabExercise("ex-1", "v-1"), makeVocabExercise("ex-2", "v-2"), makeGrammarExercise("ex-3", "g-1")];
        const config = makeMockConfig(makeAttemptBSON(oid), exercises);
        const delegate = new GetLevelTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        // ex-1 correct (v-1 not weak); ex-2 wrong (v-2 weak); ex-3 wrong (g-1 weak)
        assert.deepEqual(result.weakAreas.vocabulary, ["v-2"]);
        assert.deepEqual(result.weakAreas.grammar, ["g-1"]);
    });

    it("reports empty weak areas when all answers are correct", async () => {

        const oid = new ObjectId();
        const allCorrect = makeAttemptBSON(oid, {
            answers: [
                { exerciseId: "ex-1", isCorrect: true, userAnswer: "a", answeredAt: "2026-06-16T10:00:00.000Z" },
                { exerciseId: "ex-2", isCorrect: true, userAnswer: "b", answeredAt: "2026-06-16T10:01:00.000Z" },
                { exerciseId: "ex-3", isCorrect: true, userAnswer: "c", answeredAt: "2026-06-16T10:02:00.000Z" },
            ],
            score: 100,
            passed: true,
        });
        const exercises = [makeVocabExercise("ex-1", "v-1"), makeVocabExercise("ex-2", "v-2"), makeGrammarExercise("ex-3", "g-1")];
        const config = makeMockConfig(allCorrect, exercises);
        const delegate = new GetLevelTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.deepEqual(result.weakAreas.vocabulary, []);
        assert.deepEqual(result.weakAreas.grammar, []);
    });

    it("treats unanswered exercises as incorrect (empty userAnswer) and weak", async () => {

        const oid = new ObjectId();
        const partial = makeAttemptBSON(oid, {
            answers: [{ exerciseId: "ex-1", isCorrect: true, userAnswer: "answer-ex-1", answeredAt: "2026-06-16T10:00:00.000Z" }],
            score: 33,
            passed: false,
        });
        const exercises = [makeVocabExercise("ex-1", "v-1"), makeVocabExercise("ex-2", "v-2"), makeGrammarExercise("ex-3", "g-1")];
        const config = makeMockConfig(partial, exercises);
        const delegate = new GetLevelTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const unanswered = result.questions.find(q => q.exerciseId === "ex-2");
        assert.equal(unanswered!.userAnswer, "");
        assert.isFalse(unanswered!.isCorrect);
        assert.deepEqual(result.weakAreas.vocabulary, ["v-2"]);
        assert.deepEqual(result.weakAreas.grammar, ["g-1"]);
    });

    it("throws 404 when the attempt does not exist", async () => {

        const config = makeMockConfig(null, []);
        const delegate = new GetLevelTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString() }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 403 when the attempt belongs to a different user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid, { userId: "someone-else" }), [makeVocabExercise("ex-1", "v-1")]);
        const delegate = new GetLevelTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 403");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });

    it("throws 400 when the attempt is not yet submitted", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(makeAttemptBSON(oid, { takenAt: null }), [makeVocabExercise("ex-1", "v-1")]);
        const delegate = new GetLevelTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });
});
