import { assert } from "chai";
import { User } from "../src/model/User";
import { UserStore } from "../src/store/UserStore";

function makeMockCollection(docs: any[]) {

    return {
        findOne: async (filter: any) => docs.find(d => d.email === filter.email) ?? null,
        insertOne: async (doc: any) => { docs.push(doc); return { insertedId: "mock" }; },
        findOneAndUpdate: async (filter: any, update: any, _options: any) => {
            const idx = docs.findIndex(d => d.email === filter.email);
            if (idx === -1) return null;
            docs[idx] = { ...docs[idx], ...update.$set };
            return docs[idx];
        },
    };
}

function makeMockDb(collection: any) {
    return { collection: () => collection } as any;
}

describe("UserStore.updateCefrLevel", () => {

    it("updates the cefrLevel field and returns the updated user", async () => {

        const original = new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" });
        const col = makeMockCollection([original.toBSON()]);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        const result = await store.updateCefrLevel("alice@example.com", "A2");

        assert.equal(result.email, "alice@example.com");
        assert.equal(result.cefrLevel, "A2");
    });

    it("persists the updated cefrLevel in the underlying collection", async () => {

        const docs = [new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" }).toBSON()];
        const col = makeMockCollection(docs);
        const store = new UserStore({ db: makeMockDb(col), config: {} as any });

        await store.updateCefrLevel("alice@example.com", "A2");

        assert.equal(docs[0].cefrLevel, "A2");
    });

});
