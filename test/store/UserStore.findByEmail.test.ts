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
        findOne: async (filter: any) => docs.find(d => d.email === filter.email) ?? null,
        insertOne: async (doc: any) => { docs.push(doc); return { insertedId: "mock" }; },
        findOneAndUpdate: async () => null,
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserStore.findByEmail", () => {

    it("returns the user when a matching document exists", async () => {

        const col = makeMockCollection([makeUser().toBSON()]);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const result = await store.findByEmail("alice@example.com");

        assert.isNotNull(result);
        assert.equal(result!.email, "alice@example.com");
        assert.equal(result!.id, "uuid-001");
    });

    it("returns null when no document matches the email", async () => {

        const col = makeMockCollection([]);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const result = await store.findByEmail("nobody@example.com");

        assert.isNull(result);
    });

});
