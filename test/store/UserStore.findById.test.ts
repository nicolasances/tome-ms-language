import { assert } from "chai";
import { User } from "../../src/model/User";
import { UserStore } from "../../src/store/UserStore";

function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
    return new User({
        id: "uuid-001",
        email: "alice@example.com",
        cefrLevel: "A1",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    });
}

function makeMockCollection(docs: any[] = []) {

    return {
        findOne: async (filter: any) => docs.find(d => d.id === filter.id) ?? null,
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserStore.findById", () => {

    it("returns the user when a matching document exists", async () => {

        const col = makeMockCollection([makeUser().toBSON()]);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const result = await store.findById("uuid-001");

        assert.isNotNull(result);
        assert.equal(result!.id, "uuid-001");
        assert.equal(result!.cefrLevel, "A1");
    });

    it("returns null when no document matches the id", async () => {

        const col = makeMockCollection([]);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const result = await store.findById("missing");

        assert.isNull(result);
    });

});
