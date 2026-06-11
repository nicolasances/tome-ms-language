import { assert } from "chai";
import { ObjectId } from "mongodb";
import { ModuleTestAttempt, TestAnswer } from "../../src/model/ModuleTestAttempt";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { ModuleTestAttemptStore } from "../../src/store/ModuleTestAttemptStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttempt(overrides: Partial<ConstructorParameters<typeof ModuleTestAttempt>[0]> = {}): ModuleTestAttempt {
    return new ModuleTestAttempt({
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1", "ex-2", "ex-3"],
        answers: [],
        currentPosition: 0,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    });
}

function makeAnswer(exerciseId: string, isCorrect = true): TestAnswer {
    return { exerciseId, isCorrect, userAnswer: "hej", answeredAt: "2026-06-11T10:00:00.000Z" };
}

/**
 * Builds an in-memory mock collection for the moduleTestAttempts collection.
 * Supports: insertOne, findOne, updateOne.
 * Stores documents in a mutable `docs` array for inspection.
 */
function makeMockCollection(initialDocs: any[] = []) {

    const docs = [...initialDocs];

    return {
        docs,
        insertOne: async (doc: any) => {
            const oid = new ObjectId();
            docs.push({ _id: oid, ...doc });
            return { insertedId: oid };
        },
        findOne: async (filter: any) => {
            if (filter._id) return docs.find(d => d._id.equals(filter._id)) ?? null;
            return docs.find(d => Object.keys(filter).every(k => d[k] === filter[k])) ?? null;
        },
        updateOne: async (filter: any, update: any) => {
            const doc = docs.find(d => filter._id ? d._id.equals(filter._id) : Object.keys(filter).every(k => d[k] === filter[k]));
            if (!doc) return { matchedCount: 0 };
            if (update.$push) {
                for (const [field, value] of Object.entries(update.$push as Record<string, any>)) {
                    doc[field] = [...(doc[field] ?? []), value];
                }
            }
            if (update.$inc) {
                for (const [field, delta] of Object.entries(update.$inc as Record<string, any>)) {
                    doc[field] = (doc[field] ?? 0) + delta;
                }
            }
            if (update.$set) {
                for (const [field, value] of Object.entries(update.$set as Record<string, any>)) {
                    doc[field] = value;
                }
            }
            return { matchedCount: 1 };
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ModuleTestAttemptStore.create", () => {

    it("inserts the attempt and returns the generated _id as a string", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const id = await store.create(makeAttempt());

        assert.isString(id);
        assert.equal(id.length, 24);
        assert.equal(col.docs.length, 1);
    });
});

describe("ModuleTestAttemptStore.findById", () => {

    it("returns the matching attempt when it exists", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        const found = await store.findById(id);

        assert.isNotNull(found);
        assert.equal(found!.id, id);
        assert.equal(found!.userId, "user-1");
    });

    it("returns null when no attempt has the given id", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const found = await store.findById(new ObjectId().toString());

        assert.isNull(found);
    });
});

describe("ModuleTestAttemptStore.findActiveByUserAndModule", () => {

    it("returns an in-progress attempt (takenAt is null)", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt({ userId: "user-1", moduleId: "mod-1", takenAt: null }));

        const found = await store.findActiveByUserAndModule("user-1", "mod-1");

        assert.isNotNull(found);
        assert.equal(found!.id, id);
    });

    it("returns null when no in-progress attempt exists", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const found = await store.findActiveByUserAndModule("user-1", "mod-1");

        assert.isNull(found);
    });
});

describe("ModuleTestAttemptStore.appendAnswer", () => {

    it("pushes the answer to the answers array", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());
        const answer = makeAnswer("ex-1", true);

        await store.appendAnswer(id, answer);

        const doc = col.docs[0];
        assert.equal(doc.answers.length, 1);
        assert.equal(doc.answers[0].exerciseId, "ex-1");
        assert.equal(doc.answers[0].isCorrect, true);
    });
});

describe("ModuleTestAttemptStore.advancePosition", () => {

    it("increments currentPosition by 1", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt({ currentPosition: 0 }));

        await store.advancePosition(id);

        const doc = col.docs[0];
        assert.equal(doc.currentPosition, 1);
    });
});

describe("ModuleTestAttemptStore.addVerifiedExerciseId", () => {

    it("pushes the exerciseId to verifiedExerciseIds", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        await store.addVerifiedExerciseId(id, "ex-1");

        const doc = col.docs[0];
        assert.deepEqual(doc.verifiedExerciseIds, ["ex-1"]);
    });
});

describe("ModuleTestAttemptStore.flipAnswerToCorrect", () => {

    it("sets isCorrect=true on the matching answer entry in the answers array", async () => {

        const oid = new ObjectId();
        const existingDoc = {
            _id: oid,
            ...makeAttempt({
                answers: [{ exerciseId: "ex-1", isCorrect: false, userAnswer: "forkert", answeredAt: "2026-06-11T10:00:00.000Z" }],
            }).toBSON(),
        };

        const col = makeMockCollection([existingDoc]);
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        await store.flipAnswerToCorrect(oid.toString(), "ex-1");

        const doc = col.docs[0];
        assert.equal(doc.answers[0].isCorrect, true);
    });
});

describe("ModuleTestAttemptStore.submit", () => {

    it("sets score, passed, takenAt, and exerciseResults on the attempt", async () => {

        const col = makeMockCollection();
        const store = new ModuleTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        const exerciseResults = [new ExerciseResult({ exerciseId: "ex-1", type: "translation_active", isCorrect: true, userAnswer: "hej", correctAnswer: "hej", timestamp: "2026-06-11T10:00:00.000Z", moduleId: "mod-1" })];

        await store.submit(id, { score: 80, passed: true, takenAt: "2026-06-11T11:00:00.000Z", exerciseResults });

        const doc = col.docs[0];
        assert.equal(doc.score, 80);
        assert.equal(doc.passed, true);
        assert.equal(doc.takenAt, "2026-06-11T11:00:00.000Z");
        assert.equal(doc.exerciseResults.length, 1);
    });
});
