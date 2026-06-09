import { assert } from "chai";
import { User } from "../../src/model/User";

const sampleBSON = {
    _id: "mongo-oid",
    id: "uuid-123",
    email: "test@example.com",
    cefrLevel: "A1",
    createdAt: "2026-01-01T00:00:00.000Z",
};

describe("User.fromBSON", () => {

    it("maps all fields from a BSON document", () => {

        const user = User.fromBSON(sampleBSON as any);

        assert.equal(user.id, "uuid-123");
        assert.equal(user.email, "test@example.com");
        assert.equal(user.cefrLevel, "A1");
        assert.equal(user.createdAt, "2026-01-01T00:00:00.000Z");
    });

});

describe("User.toBSON", () => {

    it("produces a plain object with all fields", () => {

        const user = new User({ id: "uuid-123", email: "test@example.com", cefrLevel: "B1", createdAt: "2026-01-01T00:00:00.000Z" });

        const bson = user.toBSON();

        assert.equal(bson.id, "uuid-123");
        assert.equal(bson.email, "test@example.com");
        assert.equal(bson.cefrLevel, "B1");
        assert.equal(bson.createdAt, "2026-01-01T00:00:00.000Z");
    });

    it("round-trips through fromBSON without data loss", () => {

        const original = new User({ id: "uuid-abc", email: "roundtrip@example.com", cefrLevel: "C1", createdAt: "2026-06-01T12:00:00.000Z" });

        const restored = User.fromBSON(original.toBSON() as any);

        assert.equal(restored.id, original.id);
        assert.equal(restored.email, original.email);
        assert.equal(restored.cefrLevel, original.cefrLevel);
        assert.equal(restored.createdAt, original.createdAt);
    });

});
