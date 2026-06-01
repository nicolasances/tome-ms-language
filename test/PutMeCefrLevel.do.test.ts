import { assert } from "chai";
import { User } from "../src/model/User";
import { PutMeCefrLevel } from "../src/dlg/PutMeCefrLevel";

function makeMockConfig(docs: any[]) {

    const collection = {
        findOne: async (filter: any) => docs.find(d => d.email === filter.email) ?? null,
        insertOne: async (doc: any) => { docs.push(doc); return { insertedId: "mock" }; },
        findOneAndUpdate: async (filter: any, update: any, _options: any) => {
            const idx = docs.findIndex(d => d.email === filter.email);
            if (idx === -1) return null;
            docs[idx] = { ...docs[idx], ...update.$set };
            return docs[idx];
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: () => collection }),
    } as any;
}

const userContext = { email: "alice@example.com", userId: "u1", authProvider: "test" };

describe("PutMeCefrLevel.do", () => {

    it("advances cefrLevel from A1 to A2 and returns the updated profile", async () => {

        const user = new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" });
        const config = makeMockConfig([user.toBSON()]);
        const delegate = new PutMeCefrLevel({} as any, config);

        const result = await delegate.do({ cefrLevel: "A2" }, userContext);

        assert.equal(result.cefrLevel, "A2");
        assert.equal(result.email, "alice@example.com");
    });

    it("throws 404 when no user profile exists for the requesting email", async () => {

        const config = makeMockConfig([]);
        const delegate = new PutMeCefrLevel({} as any, config);

        try {
            await delegate.do({ cefrLevel: "A2" }, userContext);
            assert.fail("Expected an error to be thrown");
        } catch (err: any) {
            assert.equal(err.code, 404);
        }
    });

    it("throws 400 when the user is already at C2 — no next level exists", async () => {

        const user = new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "C2", createdAt: "2026-01-01T00:00:00.000Z" });
        const config = makeMockConfig([user.toBSON()]);
        const delegate = new PutMeCefrLevel({} as any, config);

        try {
            await delegate.do({ cefrLevel: "C2" }, userContext);
            assert.fail("Expected an error to be thrown");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

    it("throws 400 when the requested level is not the immediate next tier", async () => {

        const user = new User({ id: "uuid-001", email: "alice@example.com", cefrLevel: "A1", createdAt: "2026-01-01T00:00:00.000Z" });
        const config = makeMockConfig([user.toBSON()]);
        const delegate = new PutMeCefrLevel({} as any, config);

        try {
            await delegate.do({ cefrLevel: "B1" }, userContext);
            assert.fail("Expected an error to be thrown");
        } catch (err: any) {
            assert.equal(err.code, 400);
        }
    });

});
