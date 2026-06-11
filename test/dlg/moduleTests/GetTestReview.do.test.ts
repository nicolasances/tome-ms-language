import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetTestReview } from "../../../src/dlg/moduleTests/GetTestReview";
import { Exercise } from "../../../src/model/Exercise";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExerciseBSON(id: string, answer: string): any {
    return new Exercise({
        id,
        moduleId: "mod-1",
        type: "translation_active",
        prompt: `prompt-${id}`,
        answer,
        vocabularyItemId: "v-1",
        grammarConceptId: null,
    }).toBSON();
}

function makeAttemptBSON(oid: ObjectId, overrides: any = {}): any {
    return {
        _id: oid,
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [
            { exerciseId: "ex-1", isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-11T10:00:00.000Z" },
            { exerciseId: "ex-2", isCorrect: false, userAnswer: "forkert", answeredAt: "2026-06-11T10:01:00.000Z" },
        ],
        currentPosition: 2,
        verifiedExerciseIds: [],
        score: 50,
        passed: false,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: "2026-06-11T10:05:00.000Z",
        exerciseResults: [],
        ...overrides,
    };
}

function makeMockConfig(attemptDoc: any | null, exerciseDocs: any[]) {

    const collections: Record<string, any> = {
        moduleTestAttempts: {
            findOne: async (filter: any) => {
                if (!attemptDoc) return null;
                if (filter._id) return attemptDoc._id.equals(filter._id) ? attemptDoc : null;
                return null;
            },
        },
        exercises: {
            find: () => ({ toArray: async () => exerciseDocs }),
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GetTestReview.do", () => {

    it("returns score, passed, and per-question results including correct answers", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(
            makeAttemptBSON(oid),
            [makeExerciseBSON("ex-1", "hej"), makeExerciseBSON("ex-2", "farvel")]
        );
        const delegate = new GetTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        assert.equal(result.score, 50);
        assert.isFalse(result.passed);
        assert.equal(result.questions.length, 2);
    });

    it("exposes the correct answer for every question in the review", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(
            makeAttemptBSON(oid),
            [makeExerciseBSON("ex-1", "hej"), makeExerciseBSON("ex-2", "farvel")]
        );
        const delegate = new GetTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const q1 = result.questions.find(q => q.exerciseId === "ex-1")!;
        const q2 = result.questions.find(q => q.exerciseId === "ex-2")!;

        assert.equal(q1.correctAnswer, "hej");
        assert.equal(q2.correctAnswer, "farvel");
    });

    it("includes the user's answer and marks incorrect answers on wrong questions", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(
            makeAttemptBSON(oid),
            [makeExerciseBSON("ex-1", "hej"), makeExerciseBSON("ex-2", "farvel")]
        );
        const delegate = new GetTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const q2 = result.questions.find(q => q.exerciseId === "ex-2")!;

        assert.isFalse(q2.isCorrect);
        assert.equal(q2.userAnswer, "forkert");
    });

    it("marks unanswered exercises as incorrect with empty userAnswer in the review", async () => {

        const oid = new ObjectId();
        // Only ex-1 was answered; ex-2 was not
        const attemptDoc = makeAttemptBSON(oid, {
            answers: [{ exerciseId: "ex-1", isCorrect: true, userAnswer: "hej", answeredAt: "2026-06-11T10:00:00.000Z" }],
        });
        const config = makeMockConfig(attemptDoc, [makeExerciseBSON("ex-1", "hej"), makeExerciseBSON("ex-2", "farvel")]);
        const delegate = new GetTestReview({} as any, config);

        const result = await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);

        const unanswered = result.questions.find(q => q.exerciseId === "ex-2")!;

        assert.isNotNull(unanswered);
        assert.isFalse(unanswered.isCorrect);
        assert.equal(unanswered.userAnswer, "");
    });

    it("throws 404 when the attempt is not found", async () => {

        const config = makeMockConfig(null, []);
        const delegate = new GetTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: new ObjectId().toString() }, {} as any);
            assert.fail("Expected 404");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the attempt is not yet submitted (takenAt is null)", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(
            makeAttemptBSON(oid, { takenAt: null, score: null, passed: null }),
            [makeExerciseBSON("ex-1", "hej")]
        );
        const delegate = new GetTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 400");

        } catch (err: any) {

            assert.equal(err.code, 400);
        }
    });

    it("throws 403 when the attempt does not belong to the requesting user", async () => {

        const oid = new ObjectId();
        const config = makeMockConfig(
            makeAttemptBSON(oid, { userId: "other-user" }),
            []
        );
        const delegate = new GetTestReview({} as any, config);

        try {

            await delegate.do({ userId: "user-1", attemptId: oid.toString() }, {} as any);
            assert.fail("Expected 403");

        } catch (err: any) {

            assert.equal(err.code, 403);
        }
    });
});
