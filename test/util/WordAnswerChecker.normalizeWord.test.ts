import { assert } from "chai";
import { normalizeWord } from "../../src/util/WordAnswerChecker";

describe("WordAnswerChecker.normalizeWord", () => {

    it("lowercases and strips punctuation", () => {
        assert.equal(normalizeWord("Arbejde."), "arbejde");
    });

    it("removes a single leading 'at '", () => {
        assert.equal(normalizeWord("at arbejde"), "arbejde");
    });

    it("removes a single leading 'en '", () => {
        assert.equal(normalizeWord("en bil"), "bil");
    });

    it("removes a single leading 'et '", () => {
        assert.equal(normalizeWord("Et hus"), "hus");
    });

    it("removes only one leading article", () => {
        assert.equal(normalizeWord("at at arbejde"), "at arbejde");
    });

    it("does not strip an article-like prefix that is part of a word", () => {
        assert.equal(normalizeWord("enhed"), "enhed");
        assert.equal(normalizeWord("atlas"), "atlas");
    });

    it("keeps a word that is itself an article", () => {
        assert.equal(normalizeWord("en"), "en");
    });
});
