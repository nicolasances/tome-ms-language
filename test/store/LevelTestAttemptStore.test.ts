import { assert } from "chai";
import { ObjectId } from "mongodb";
import { LevelTestAttempt } from "../../src/model/LevelTestAttempt";
import { TestAnswer } from "../../src/model/ModuleTestAttempt";
import { ExerciseResult } from "../../src/model/ExerciseResult";
import { LevelTestAttemptStore } from "../../src/store/LevelTestAttemptStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAttempt(overrides: Partial<ConstructorParameters<typeof LevelTestAttempt>[0]> = {}): LevelTestAttempt {
    return new LevelTestAttempt({
        userId: "user-1",
        cefrLevel: "A1",
        exerciseIds: ["ex-1", "ex-2", "ex-3"],
        answers: [],
        currentPosition: 0,
        verifiedExerciseIds: [],
        score: null,
        passed: null,
        startedAt: "2026-06-16T09:00:00.000Z",
        takenAt: null,
        exerciseResults: [],
        ...overrides,
    });
}

function makeAnswer(exerciseId: string, isCorrect = true): TestAnswer {
    return { exerciseId, isCorrect, userAnswer: "hej", answeredAt: "2026-06-16T10:00:00.000Z" };
}

/**
 * Builds an in-memory mock collection for the levelTestAttempts collection.
 * Supports: insertOne, findOne, find (with sort + limit), updateOne.
 */
function makeMockCollection(initialDocs: any[] = []) {

    const docs = [...initialDocs];

    const matches = (d: any, filter: any) => Object.keys(filter).every(k => {
        if (k === "_id") return d._id.equals(filter._id);
        if (k.includes('.')) {
            const [field, subField] = k.split('.');
            return Array.isArray(d[field]) && d[field].some((item: any) => item[subField] === filter[k]);
        }
        const condition = filter[k];
        if (condition && typeof condition === "object" && "$ne" in condition) return d[k] !== condition.$ne;
        return d[k] === condition;
    });

    return {
        docs,
        insertOne: async (doc: any) => {
            const oid = new ObjectId();
            docs.push({ _id: oid, ...doc });
            return { insertedId: oid };
        },
        findOne: async (filter: any) => docs.find(d => matches(d, filter)) ?? null,
        find: (filter: any) => {
            let result = docs.filter(d => matches(d, filter));
            return {
                sort: (spec: any) => {
                    const [field, dir] = Object.entries(spec)[0] as [string, number];
                    result = [...result].sort((a, b) => (a[field] > b[field] ? 1 : a[field] < b[field] ? -1 : 0) * dir);
                    return {
                        limit: (n: number) => ({ toArray: async () => result.slice(0, n) }),
                        toArray: async () => result,
                    };
                },
            };
        },
        updateOne: async (filter: any, update: any) => {
            const doc = docs.find(d => matches(d, filter));
            if (!doc) return { matchedCount: 0 };
            if (update.$push) for (const [field, value] of Object.entries(update.$push as Record<string, any>)) doc[field] = [...(doc[field] ?? []), value];
            if (update.$inc) for (const [field, delta] of Object.entries(update.$inc as Record<string, any>)) doc[field] = (doc[field] ?? 0) + delta;
            if (update.$set) {
                for (const [field, value] of Object.entries(update.$set as Record<string, any>)) {
                    const positional = field.match(/^(\w+)\.\$\.(.+)$/);
                    if (positional) {
                        const [, arrayField, subField] = positional;
                        const arrayMatchKey = Object.keys(filter).find(k => k.startsWith(`${arrayField}.`));
                        if (arrayMatchKey) {
                            const matchSubField = arrayMatchKey.split('.')[1];
                            const item = (doc[arrayField] ?? []).find((x: any) => x[matchSubField] === filter[arrayMatchKey]);
                            if (item) item[subField] = value;
                        }
                    } else {
                        doc[field] = value;
                    }
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

describe("LevelTestAttemptStore.create", () => {

    it("inserts the attempt and returns the generated _id as a string", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const id = await store.create(makeAttempt());

        assert.isString(id);
        assert.equal(id.length, 24);
        assert.equal(col.docs.length, 1);
    });
});

describe("LevelTestAttemptStore.findById", () => {

    it("returns the matching attempt when it exists", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        const found = await store.findById(id);

        assert.isNotNull(found);
        assert.equal(found!.id, id);
        assert.equal(found!.cefrLevel, "A1");
    });

    it("returns null when no attempt has the given id", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const found = await store.findById(new ObjectId().toString());

        assert.isNull(found);
    });
});

describe("LevelTestAttemptStore.findActiveByUserAndLevel", () => {

    it("returns an in-progress attempt (takenAt is null)", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt({ takenAt: null }));

        const found = await store.findActiveByUserAndLevel("user-1", "A1");

        assert.isNotNull(found);
        assert.equal(found!.id, id);
    });

    it("returns null when only a submitted attempt exists", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        await store.create(makeAttempt({ takenAt: "2026-06-16T11:00:00.000Z" }));

        const found = await store.findActiveByUserAndLevel("user-1", "A1");

        assert.isNull(found);
    });
});

describe("LevelTestAttemptStore.findMostRecentSubmittedByUserAndLevel", () => {

    it("returns the most recently submitted attempt for the user + level", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        await store.create(makeAttempt({ takenAt: "2026-06-16T09:00:00.000Z", score: 50, passed: false }));
        await store.create(makeAttempt({ takenAt: "2026-06-16T11:00:00.000Z", score: 60, passed: false }));

        const found = await store.findMostRecentSubmittedByUserAndLevel("user-1", "A1");

        assert.isNotNull(found);
        assert.equal(found!.takenAt, "2026-06-16T11:00:00.000Z");
    });

    it("ignores in-progress attempts (takenAt null)", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        await store.create(makeAttempt({ takenAt: null }));

        const found = await store.findMostRecentSubmittedByUserAndLevel("user-1", "A1");

        assert.isNull(found);
    });

    it("returns null when no attempt exists for the level", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });

        const found = await store.findMostRecentSubmittedByUserAndLevel("user-1", "A1");

        assert.isNull(found);
    });
});

describe("LevelTestAttemptStore.appendAnswer", () => {

    it("pushes the answer to the answers array", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        await store.appendAnswer(id, makeAnswer("ex-1", true));

        const doc = col.docs[0];
        assert.equal(doc.answers.length, 1);
        assert.equal(doc.answers[0].exerciseId, "ex-1");
        assert.equal(doc.answers[0].isCorrect, true);
    });
});

describe("LevelTestAttemptStore.advancePosition", () => {

    it("increments currentPosition by 1", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt({ currentPosition: 0 }));

        await store.advancePosition(id);

        assert.equal(col.docs[0].currentPosition, 1);
    });
});

describe("LevelTestAttemptStore.submit", () => {

    it("sets score, passed, takenAt, and exerciseResults on the attempt", async () => {

        const col = makeMockCollection();
        const store = new LevelTestAttemptStore({ db: makeMockDb(col), config: {} as any });
        const id = await store.create(makeAttempt());

        const exerciseResults = [new ExerciseResult({ exerciseId: "ex-1", type: "translation_active", isCorrect: true, userAnswer: "hej", correctAnswer: "hej", timestamp: "2026-06-16T10:00:00.000Z", moduleId: null })];

        await store.submit(id, { score: 80, passed: true, takenAt: "2026-06-16T11:00:00.000Z", exerciseResults });

        const doc = col.docs[0];
        assert.equal(doc.score, 80);
        assert.equal(doc.passed, true);
        assert.equal(doc.takenAt, "2026-06-16T11:00:00.000Z");
        assert.equal(doc.exerciseResults.length, 1);
    });
});
