import { assert } from "chai";
import { User } from "../src/model/User";
import { GetMe } from "../src/dlg/user/GetMe";

function makeMockConfig(docs: any[]) {

    const collection = {
        findOne: async (filter: any) => docs.find(d => d.email === filter.email) ?? null,
        insertOne: async (doc: any) => { docs.push(doc); return { insertedId: "mock" }; },
        findOneAndUpdate: async () => null,
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => collection }),
    } as any;
}

describe("GetMe.do", () => {

    it("returns the user profile when a profile exists for the requesting email", async () => {

        const existing = new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "B1", createdAt: "2026-01-01T00:00:00.000Z" });
        const config = makeMockConfig([existing.toBSON()]);
        const delegate = new GetMe({} as any, config);

        const result = await delegate.do({}, { email: "alice@example.com", userId: "u1", authProvider: "test" });

        assert.equal(result.id, "uuid-001");
        assert.equal(result.email, "alice@example.com");
        assert.equal(result.cefrLevel, "B1");
    });

    it("throws a 404 ValidationError when no profile exists for the requesting email", async () => {

        const config = makeMockConfig([]);
        const delegate = new GetMe({} as any, config);

        try {
            await delegate.do({}, { email: "nobody@example.com", userId: "u1", authProvider: "test" });
            assert.fail("Expected an error to be thrown");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

});

