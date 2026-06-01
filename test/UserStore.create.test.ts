import { assert } from "chai";
import { User } from "../src/model/User";
import { UserStore } from "../src/store/UserStore";

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

describe("UserStore.create", () => {

    it("inserts the user document into the collection", async () => {

        const docs: any[] = [];
        const col = makeMockCollection(docs);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const user = new User({ id: "uuid-new", email: "bob@example.com", cefrLevel: "A1", createdAt: "2026-06-01T00:00:00.000Z" });

        await store.create(user);

        assert.equal(docs.length, 1);
        assert.equal(docs[0].email, "bob@example.com");
    });

    it("returns the same user that was passed in", async () => {

        const col = makeMockCollection();
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const user = new User({ id: "uuid-new", email: "bob@example.com", cefrLevel: "A1", createdAt: "2026-06-01T00:00:00.000Z" });

        const result = await store.create(user);

        assert.equal(result.id, user.id);
        assert.equal(result.email, user.email);
        assert.equal(result.cefrLevel, user.cefrLevel);
    });

});
