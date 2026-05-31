import { assert } from "chai";
import { ObjectId } from "mongodb";
import { VocabularyItem, VOCABULARY_ITEM_TYPES, CEFR_LEVELS, VOCABULARY_ITEM_SOURCES } from "../src/model/VocabularyItem";

describe("VocabularyItem — exported constants", () => {

    it("VOCABULARY_ITEM_TYPES contains all nine types", () => {
        assert.includeMembers([...VOCABULARY_ITEM_TYPES], ["noun", "verb", "adjective", "adverb", "phrase", "pattern", "connector", "pronoun", "number"]);
        assert.equal(VOCABULARY_ITEM_TYPES.length, 9);
    });

    it("CEFR_LEVELS contains all six levels", () => {
        assert.includeMembers([...CEFR_LEVELS], ["A1", "A2", "B1", "B2", "C1", "C2"]);
        assert.equal(CEFR_LEVELS.length, 6);
    });

    it("VOCABULARY_ITEM_SOURCES contains curriculum and user_added", () => {
        assert.includeMembers([...VOCABULARY_ITEM_SOURCES], ["curriculum", "user_added"]);
        assert.equal(VOCABULARY_ITEM_SOURCES.length, 2);
    });

});

describe("VocabularyItem.fromBSON", () => {

    it("maps all fields from a BSON document", () => {
        const doc = {
            _id: new ObjectId(),
            id: "A1-01-v-jeg-5325",
            danish: "jeg",
            english: "I",
            type: "pronoun",
            context: null,
            tags: ["personal"],
            cefrLevel: "A1",
            source: "curriculum",
            addedByUserId: null,
        };

        const item = VocabularyItem.fromBSON(doc as any);

        assert.equal(item.id, "A1-01-v-jeg-5325");
        assert.equal(item.danish, "jeg");
        assert.equal(item.english, "I");
        assert.equal(item.type, "pronoun");
        assert.isNull(item.context);
        assert.deepEqual(item.tags, ["personal"]);
        assert.equal(item.cefrLevel, "A1");
        assert.equal(item.source, "curriculum");
        assert.isNull(item.addedByUserId);
    });

    it("defaults tags to [] when absent from the document", () => {
        const doc = { _id: new ObjectId(), id: "X", danish: "hej", english: "hi", type: "phrase", context: null, cefrLevel: "A1", source: "curriculum", addedByUserId: null };
        const item = VocabularyItem.fromBSON(doc as any);
        assert.deepEqual(item.tags, []);
    });

    it("reads addedByUserId when source is user_added", () => {
        const doc = { _id: new ObjectId(), id: "U1", danish: "hund", english: "dog", type: "noun", context: null, tags: [], cefrLevel: "A1", source: "user_added", addedByUserId: "user-42" };
        const item = VocabularyItem.fromBSON(doc as any);
        assert.equal(item.addedByUserId, "user-42");
        assert.equal(item.source, "user_added");
    });

    it("reads context when present", () => {
        const doc = { _id: new ObjectId(), id: "S1", danish: "stor", english: "big", type: "adjective", context: "physical size", tags: [], cefrLevel: "A2", source: "curriculum", addedByUserId: null };
        const item = VocabularyItem.fromBSON(doc as any);
        assert.equal(item.context, "physical size");
    });

});

describe("VocabularyItem.toBSON", () => {

    it("emits all fields including null context and addedByUserId", () => {
        const item = new VocabularyItem({ id: "A1-01-v-jeg", danish: "jeg", english: "I", type: "pronoun", context: null, tags: [], cefrLevel: "A1", source: "curriculum", addedByUserId: null });
        const bson = item.toBSON();

        assert.equal(bson.id, "A1-01-v-jeg");
        assert.equal(bson.danish, "jeg");
        assert.equal(bson.english, "I");
        assert.equal(bson.type, "pronoun");
        assert.isNull(bson.context);
        assert.deepEqual(bson.tags, []);
        assert.equal(bson.cefrLevel, "A1");
        assert.equal(bson.source, "curriculum");
        assert.isNull(bson.addedByUserId);
    });

    it("does not include _id in the BSON output", () => {
        const item = new VocabularyItem({ id: "X", danish: "hej", english: "hi", type: "phrase", context: null, tags: [], cefrLevel: "A1", source: "curriculum", addedByUserId: null });
        const bson = item.toBSON();
        assert.notProperty(bson, "_id");
    });

    it("round-trips through toBSON and fromBSON", () => {
        const original = new VocabularyItem({ id: "A2-10-n-hus", danish: "hus", english: "house", type: "noun", context: "building", tags: ["home", "shelter"], cefrLevel: "A2", source: "curriculum", addedByUserId: null });
        const bson = { _id: new ObjectId(), ...original.toBSON() };
        const restored = VocabularyItem.fromBSON(bson as any);

        assert.equal(restored.id, original.id);
        assert.equal(restored.danish, original.danish);
        assert.equal(restored.english, original.english);
        assert.equal(restored.type, original.type);
        assert.equal(restored.context, original.context);
        assert.deepEqual(restored.tags, original.tags);
        assert.equal(restored.cefrLevel, original.cefrLevel);
        assert.equal(restored.source, original.source);
        assert.equal(restored.addedByUserId, original.addedByUserId);
    });

});
