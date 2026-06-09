import { assert } from "chai";
import { nextLevel, isValidCefrLevel } from "../../src/model/CefrLevels";

describe("nextLevel", () => {

    it("returns A2 after A1", () => {
        assert.equal(nextLevel("A1"), "A2");
    });

    it("returns B1 after A2", () => {
        assert.equal(nextLevel("A2"), "B1");
    });

    it("returns B2 after B1", () => {
        assert.equal(nextLevel("B1"), "B2");
    });

    it("returns C1 after B2", () => {
        assert.equal(nextLevel("B2"), "C1");
    });

    it("returns C2 after C1", () => {
        assert.equal(nextLevel("C1"), "C2");
    });

    it("returns null after C2 — no higher level exists", () => {
        assert.isNull(nextLevel("C2"));
    });

});

describe("isValidCefrLevel", () => {

    it("returns true for each valid level", () => {
        assert.isTrue(isValidCefrLevel("A1"));
        assert.isTrue(isValidCefrLevel("A2"));
        assert.isTrue(isValidCefrLevel("B1"));
        assert.isTrue(isValidCefrLevel("B2"));
        assert.isTrue(isValidCefrLevel("C1"));
        assert.isTrue(isValidCefrLevel("C2"));
    });

    it("returns false for an unknown string", () => {
        assert.isFalse(isValidCefrLevel("Z9"));
    });

    it("returns false for an empty string", () => {
        assert.isFalse(isValidCefrLevel(""));
    });

    it("returns false for a lowercase variant", () => {
        assert.isFalse(isValidCefrLevel("a1"));
    });

});
