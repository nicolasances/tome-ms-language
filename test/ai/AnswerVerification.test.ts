import { assert } from "chai";
import { COMMON_JUDGING_RULES, generateOptionalNote, resolveVerificationClient } from "../../src/ai/AnswerVerification";

describe("AnswerVerification.generateOptionalNote", () => {

    it("returns the trimmed explanation", async () => {
        const note = await generateOptionalNote({ generate: async () => JSON.stringify({ explanation: "  Correct!  " }) }, "p");

        assert.equal(note, "Correct!");
    });

    it("returns undefined when there is nothing to add", async () => {
        assert.isUndefined(await generateOptionalNote({ generate: async () => "{}" }, "p"));
    });

    it("returns undefined instead of throwing when the AI fails or returns garbage", async () => {
        assert.isUndefined(await generateOptionalNote({ generate: async () => { throw new Error("boom"); } }, "p"));
        assert.isUndefined(await generateOptionalNote({ generate: async () => "not json" }, "p"));
    });
});

describe("AnswerVerification.resolveVerificationClient", () => {

    it("returns the injected client when there is one", () => {
        const client = { generate: async () => "" };

        assert.strictEqual(resolveVerificationClient(client), client);
    });

    it("tells the model to ignore case and punctuation", () => {
        assert.include(COMMON_JUDGING_RULES, "Ignore case");
        assert.include(COMMON_JUDGING_RULES, "Ignore punctuation");
    });
});
