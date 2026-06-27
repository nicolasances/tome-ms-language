import { assert } from "chai";
import { MODULE_TEST_SIZE } from "../../src/Config";
import { Module } from "../../src/model/Module";

const baseInput = {
    id: "mod-1",
    title: "A1 Basics",
    theme: "greetings",
    communicationGoal: "greet people",
    cefrLevel: "A1",
};

describe("Module model — testQuestionCount", () => {

    it("defaults testQuestionCount to MODULE_TEST_SIZE when not provided in constructor", () => {

        const mod = new Module(baseInput);

        assert.equal(mod.testQuestionCount, MODULE_TEST_SIZE);
    });

    it("uses caller-provided testQuestionCount in constructor", () => {

        const mod = new Module({ ...baseInput, testQuestionCount: 10 });

        assert.equal(mod.testQuestionCount, 10);
    });

    it("defaults testQuestionCount to MODULE_TEST_SIZE when absent from BSON", () => {

        const bson = { ...baseInput };
        const mod = Module.fromBSON(bson as any);

        assert.equal(mod.testQuestionCount, MODULE_TEST_SIZE);
    });

    it("reads testQuestionCount from BSON when present", () => {

        const bson = { ...baseInput, testQuestionCount: 15 };
        const mod = Module.fromBSON(bson as any);

        assert.equal(mod.testQuestionCount, 15);
    });

    it("emits testQuestionCount in toBSON", () => {

        const mod = new Module({ ...baseInput, testQuestionCount: 12 });
        const bson = mod.toBSON();

        assert.equal(bson.testQuestionCount, 12);
    });

    it("emits default testQuestionCount in toBSON when not provided", () => {

        const mod = new Module(baseInput);
        const bson = mod.toBSON();

        assert.equal(bson.testQuestionCount, MODULE_TEST_SIZE);
    });
});
