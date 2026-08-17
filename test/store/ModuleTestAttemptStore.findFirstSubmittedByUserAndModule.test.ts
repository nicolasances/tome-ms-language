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
 * In-memory mock of the moduleTestAttempts collection supporting findOne with a sort option
 * and the `takenAt: { $ne: null }` filter the store uses.
 */
function makeMockCollection(docs: any[]) {

    return {
        lastFilter: null as any,
        findOne: async function (filter: any, options: any = {}) {

            this.lastFilter = filter;

            let matching = docs.filter(d => d.userId === filter.userId && d.moduleId === filter.moduleId);

            if (filter.takenAt?.$ne === null) matching = matching.filter(d => d.takenAt !== null);

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

        const first = makeAttemptBSON({ takenAt: "2026-06-11T10:00:00.000Z", score: 60, passed: false });
        const second = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z", score: 90, passed: true });

        const { store } = makeStore([second, first]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1");

        assert.instanceOf(result, ModuleTestAttempt);
        assert.equal(result!.takenAt, "2026-06-11T10:00:00.000Z");
        assert.equal(result!.score, 60);
    });

    it("returns a failed first attempt rather than skipping to the passing one", async () => {

        const failed = makeAttemptBSON({ takenAt: "2026-06-11T10:00:00.000Z", score: 50, passed: false });
        const passed = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z", score: 85, passed: true });

        const { store } = makeStore([failed, passed]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1");

        assert.equal(result!.passed, false);
    });

    it("ignores in-progress attempts (takenAt = null)", async () => {

        const inProgress = makeAttemptBSON({ takenAt: null, score: null, passed: null });
        const submitted = makeAttemptBSON({ takenAt: "2026-06-12T10:00:00.000Z" });

        const { store } = makeStore([inProgress, submitted]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1");

        assert.equal(result!.takenAt, "2026-06-12T10:00:00.000Z");
    });

    it("returns null when the user has never submitted an attempt for the module", async () => {

        const { store } = makeStore([makeAttemptBSON({ moduleId: "other-mod" })]);

        const result = await store.findFirstSubmittedByUserAndModule("user-1", "mod-1");

        assert.isNull(result);
    });
});
