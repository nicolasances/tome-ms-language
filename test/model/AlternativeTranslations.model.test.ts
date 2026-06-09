import { assert } from "chai";
import { ObjectId } from "mongodb";
import { Sentence } from "../../src/model/Sentence";

describe("Sentence.fromBSON — alternativeTranslations", () => {

    it("defaults to [] when alternativeTranslations is absent from the document", () => {
        const doc = { _id: new ObjectId(), language: "danish", sentence: "Hunden løber", translation: "The dog runs", createdAt: "2026-01-01T00:00:00.000Z", knowledgeSource: "test" };
        const sentence = Sentence.fromBSON(doc as any);
        assert.deepEqual(sentence.alternativeTranslations, []);
    });

    it("reads alternativeTranslations when present in the document", () => {
        const alts = [{ id: "uuid-2", translation: "the dog is running" }];
        const doc = { _id: new ObjectId(), language: "danish", sentence: "Hunden løber", translation: "The dog runs", createdAt: "2026-01-01T00:00:00.000Z", knowledgeSource: "test", alternativeTranslations: alts };
        const sentence = Sentence.fromBSON(doc as any);
        assert.deepEqual(sentence.alternativeTranslations, alts);
    });

});

describe("Sentence.toBSON — alternativeTranslations", () => {

    it("omits alternativeTranslations from the BSON document when the array is empty", () => {
        const sentence = new Sentence({ language: "danish", sentence: "Hunden løber", translation: "The dog runs", createdAt: "2026-01-01T00:00:00.000Z", knowledgeSource: "test", alternativeTranslations: [] });
        const bson = sentence.toBSON();
        assert.notProperty(bson, "alternativeTranslations");
    });

    it("includes alternativeTranslations in the BSON document when the array is non-empty", () => {
        const alts = [{ id: "uuid-2", translation: "the dog is running" }];
        const sentence = new Sentence({ language: "danish", sentence: "Hunden løber", translation: "The dog runs", createdAt: "2026-01-01T00:00:00.000Z", knowledgeSource: "test", alternativeTranslations: alts });
        const bson = sentence.toBSON();
        assert.deepEqual(bson.alternativeTranslations, alts);
    });

});
