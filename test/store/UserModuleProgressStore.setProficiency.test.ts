import { assert } from "chai";
import { ModuleProficiency } from "../../src/model/UserModuleProgress";
import { UserModuleProgressStore } from "../../src/store/UserModuleProgressStore";

function makeProficiency(): ModuleProficiency {
    return new ModuleProficiency({ score: 69.5, testScore: 57.1, practiceScore: 88, basis: "full", computedAt: "2026-08-16T10:00:00.000Z", version: 1 });
}

/**
 * In-memory mock of the userModuleProgress collection recording the updateOne calls it receives.
 */
function makeMockCollection(matchedCount = 1) {

    return {
        updates: [] as any[],
        updateOne: async function (filter: any, update: any) {

            this.updates.push({ filter, update });

            return { matchedCount };
        },
    };
}

function makeStore(collection: any) {
    return new UserModuleProgressStore({ db: { collection: () => collection } as any, config: {} as any });
}

describe("UserModuleProgressStore.setProficiency", () => {

    it("stores the serialized proficiency on the user's progress record", async () => {

        const collection = makeMockCollection();

        await makeStore(collection).setProficiency("user-1", "mod-1", makeProficiency());

        assert.equal(collection.updates.length, 1);
        assert.deepEqual(collection.updates[0].filter, { userId: "user-1", moduleId: "mod-1" });
        assert.equal(collection.updates[0].update.$set.proficiency.score, 69.5);
        assert.equal(collection.updates[0].update.$set.proficiency.basis, "full");
        assert.equal(collection.updates[0].update.$set.proficiency.version, 1);
    });

    it("touches only the proficiency field, leaving the rest of the record alone", async () => {

        const collection = makeMockCollection();

        await makeStore(collection).setProficiency("user-1", "mod-1", makeProficiency());

        assert.deepEqual(Object.keys(collection.updates[0].update.$set), ["proficiency"]);
    });

    it("reports whether a progress record was actually matched", async () => {

        assert.isTrue(await makeStore(makeMockCollection(1)).setProficiency("user-1", "mod-1", makeProficiency()));
        assert.isFalse(await makeStore(makeMockCollection(0)).setProficiency("user-1", "missing-mod", makeProficiency()));
    });
});
