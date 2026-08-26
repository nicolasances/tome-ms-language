import { assert } from "chai";
import { ObjectId } from "mongodb";
import { ModuleTestAttempt } from "../../src/model/ModuleTestAttempt";
import { ModuleTestAttemptStore } from "../../src/store/ModuleTestAttemptStore";

function makeAttemptBSON(overrides: any = {}): any {
    return {
        _id: new ObjectId(),
        userId: "user-1",
        moduleId: "mod-1",
        exerciseIds: ["ex-1"],
        answers: [],
        currentPosition: 0,
        verifiedExerciseIds: [],
        score: 90,
        passed: true,
        startedAt: "2026-06-11T09:00:00.000Z",
        takenAt: "2026-06-11T10:00:00.000Z",
        exerciseResults: [],
        ...overrides,
    };
}

/**
 * In-memory mock of the moduleTestAttempts collection supporting findOne with a sort option,
 * the `takenAt: { $ne: null }` filter, and the `passNumber` $or-legacy filter the store uses.
 * Docs with no `passNumber` field at all simulate attempts written before F25 — real Mongo
 * equality never matches a missing field, so, like the store, this mock only lets them through
 * via the `$exists: false` branch.
 */
function makeMockCollection(docs: any[]) {

    return {
        lastFilter: null as any,
        findOne: async function (filter: any, options: any = {}) {

            this.lastFilter = filter;

            let matching = docs.filter(d => d.userId === filter.userId && d.moduleId === filter.moduleId);

            if (filter.takenAt?.$ne === null) matching = matching.filter(d => d.takenAt !== null);

            if (filter.$or) {
                matching = matching.filter(d => filter.$or.some((clause: any) => {
                    const val = clause.passNumber;
                    if (val && typeof val === "object" && "$exists" in val) return val.$exists === false ? !("passNumber" in d) : ("passNumber" in d);
                    return d.passNumber === val;
                }));
            } else if (filter.passNumber !== undefined) {
                matching = matching.filter(d => d.passNumber === filter.passNumber);
            }

            if (options.sort?.takenAt === 1) matching = [...matching].sort((a, b) => a.takenAt > b.takenAt ? 1 : -1);

            return matching[0] ?? null;
        },
    };
}

function makeStore(docs: any[]) {
    const collection = makeMockCollection(docs);
    return { store: new ModuleTestAttemptStore({ db: { collection: () => collection } as any, config: {} as any }), collection };
}

describe("ModuleTestAttemptStore.findFirstSubmittedByUserAndModule", () => {

    it("returns the earliest submitted attempt for the user+module", async () => {

        const first = makeAttemptBSON({ takenAt: "2026-06-11T10:00:00.000Z", score: 60, passed: false, passNumber: 1 });
        const second = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z", score: 90, passed: true, passNumber: 1 });

        const { store } = makeStore([second, first]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 1);

        assert.instanceOf(result, ModuleTestAttempt);
        assert.equal(result!.takenAt, "2026-06-11T10:00:00.000Z");
        assert.equal(result!.score, 60);
    });

    it("returns a failed first attempt rather than skipping to the passing one", async () => {

        const failed = makeAttemptBSON({ takenAt: "2026-06-11T10:00:00.000Z", score: 50, passed: false, passNumber: 1 });
        const passed = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z", score: 85, passed: true, passNumber: 1 });

        const { store } = makeStore([failed, passed]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result!.passed, false);
    });

    it("ignores in-progress attempts (takenAt = null)", async () => {

        const inProgress = makeAttemptBSON({ takenAt: null, score: null, passed: null, passNumber: 1 });
        const submitted = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z", passNumber: 1 });

        const { store } = makeStore([inProgress, submitted]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 1);

        assert.equal(result!.takenAt, "2026-06-12T10:00:00.000Z");
    });

    it("returns null when the user has never submitted an attempt for the module", async () => {

        const { store } = makeStore([makeAttemptBSON({ moduleId: "other-mod", passNumber: 1 })]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 1);

        assert.isNull(result);
    });

    it("excludes attempts from an earlier pass — a re-practice's score must not read the old pass's attempt (F25)", async () => {

        const passOneAttempt = makeAttemptBSON({ takenAt: "2026-06-11T10:00:00.000Z", passNumber: 1 });
        const passTwoAttempt = makeAttemptBSON({ takenAt: "2026-07-10T10:00:00.000Z", passNumber: 2 });

        const { store } = makeStore([passOneAttempt, passTwoAttempt]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 2);

        assert.equal(result!.takenAt, "2026-07-10T10:00:00.000Z");
    });

    it("includes a legacy attempt with no passNumber field at all when scoring pass 1", async () => {

        const legacyAttempt = makeAttemptBSON();
        delete legacyAttempt.passNumber;

        const { store } = makeStore([legacyAttempt]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1", 1);

        assert.isNotNull(result);
    });
});
