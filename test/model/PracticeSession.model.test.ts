import { assert } from "chai";
import { ObjectId } from "mongodb";
import { PracticeSession, PracticeAnswer } from "../../src/model/PracticeSession";

function makeAnswer(overrides: Partial<PracticeAnswer> = {}): PracticeAnswer {
    return {
        exerciseId: "ex-1",
        isCorrect: true,
        userAnswer: "hej",
        answeredAt: "2026-06-09T10:00:00.000Z",
        ...overrides,
    };
}

function makeSession(overrides: Partial<ConstructorParameters<typeof PracticeSession>[0]> = {}): PracticeSession {
    return new PracticeSession({
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2"],
        answers: [],
        currentPosition: 0,
        retryQueue: [],
        startedAt: "2026-06-09T09:00:00.000Z",
        completedAt: null,
        ...overrides,
    });
}

describe("PracticeSession model", () => {

    describe("toBSON()", () => {

        it("includes all fields except id", () => {

            const session = makeSession();
            const bson = session.toBSON();

            assert.equal(bson.userId, "user-1");
            assert.equal(bson.moduleId, "mod-1");
            assert.deepEqual(bson.exerciseIds, ["ex-1", "ex-2"]);
            assert.deepEqual(bson.answers, []);
            assert.equal(bson.currentPosition, 0);
            assert.deepEqual(bson.retryQueue, []);
            assert.equal(bson.startedAt, "2026-06-09T09:00:00.000Z");
            assert.isNull(bson.completedAt);
            assert.notProperty(bson, "id");
        });

        it("includes answers when present", () => {

            const answer = makeAnswer();
            const session = makeSession({ answers: [answer] });
            const bson = session.toBSON();

            assert.lengthOf(bson.answers, 1);
            assert.equal(bson.answers[0].exerciseId, "ex-1");
            assert.isTrue(bson.answers[0].isCorrect);
            assert.equal(bson.answers[0].userAnswer, "hej");
        });
    });

    describe("fromBSON()", () => {

        it("maps _id.toString() to id and all other fields correctly", () => {

            const oid = new ObjectId();
            const bson = {
                _id: oid,
                userId: "user-1",
                moduleId: "mod-1",
                exerciseIds: ["ex-1", "ex-2"],
                answers: [makeAnswer()],
                currentPosition: 1,
                retryQueue: ["ex-1"],
                startedAt: "2026-06-09T09:00:00.000Z",
                completedAt: null,
            };

            const session = PracticeSession.fromBSON(bson as any);

            assert.equal(session.id, oid.toString());
            assert.equal(session.userId, "user-1");
            assert.equal(session.moduleId, "mod-1");
            assert.deepEqual(session.exerciseIds, ["ex-1", "ex-2"]);
            assert.lengthOf(session.answers, 1);
            assert.equal(session.currentPosition, 1);
            assert.deepEqual(session.retryQueue, ["ex-1"]);
            assert.equal(session.startedAt, "2026-06-09T09:00:00.000Z");
            assert.isNull(session.completedAt);
        });

        it("defaults completedAt to null when absent from BSON", () => {

            const oid = new ObjectId();
            const bson = {
                _id: oid,
                userId: "user-1",
                moduleId: "mod-1",
                exerciseIds: [],
                answers: [],
                currentPosition: 0,
                retryQueue: [],
                startedAt: "2026-06-09T09:00:00.000Z",
            };

            const session = PracticeSession.fromBSON(bson as any);

            assert.isNull(session.completedAt);
        });

        it("defaults answers and retryQueue to empty arrays when absent", () => {

            const oid = new ObjectId();
            const bson = {
                _id: oid,
                userId: "user-1",
                moduleId: "mod-1",
                exerciseIds: ["ex-1"],
                currentPosition: 0,
                startedAt: "2026-06-09T09:00:00.000Z",
            };

            const session = PracticeSession.fromBSON(bson as any);

            assert.deepEqual(session.answers, []);
            assert.deepEqual(session.retryQueue, []);
        });
    });
});
