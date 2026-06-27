import { assert } from "chai";
import { Request } from "express";
import { PostModule } from "../../../src/dlg/modules/PostModule";

function makeReq(body: Record<string, any>): Request {
    return { params: {}, body } as unknown as Request;
}

const validBody = {
    id: "danish-A1-01",
    title: "Greetings",
    theme: "Daily greetings",
    communicationGoal: "Greet and introduce yourself",
    cefrLevel: "A1",
    vocabularyItemIds: ["vocab-1", "vocab-2"],
    grammarConceptIds: ["grammar-1"],
};

describe("PostModule.parseRequest", () => {

    it("parses a valid body with all required fields", () => {

        const delegate = new PostModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(validBody));

        assert.equal(parsed.id, validBody.id);
        assert.equal(parsed.title, validBody.title);
        assert.equal(parsed.theme, validBody.theme);
        assert.equal(parsed.communicationGoal, validBody.communicationGoal);
        assert.equal(parsed.cefrLevel, validBody.cefrLevel);
        assert.deepEqual(parsed.vocabularyItemIds, validBody.vocabularyItemIds);
        assert.deepEqual(parsed.grammarConceptIds, validBody.grammarConceptIds);
    });

    it("accepts empty vocabularyItemIds and grammarConceptIds arrays", () => {

        const delegate = new PostModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ...validBody, vocabularyItemIds: [], grammarConceptIds: [] }));

        assert.deepEqual(parsed.vocabularyItemIds, []);
        assert.deepEqual(parsed.grammarConceptIds, []);
    });

    it("applies configurable parameter defaults when not provided", () => {

        const delegate = new PostModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq(validBody));

        assert.equal(parsed.practiceSessionSize, 20);
        assert.equal(parsed.testUnlockDelayHours, 4);
        assert.equal(parsed.testRetryDelayMinutes, 20);
        assert.equal(parsed.testPassThreshold, 80);
        assert.equal(parsed.testQuestionCount, 20);
    });

    it("does not carry a testFreshExercisePercent parameter", () => {

        const delegate = new PostModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({ ...validBody, testFreshExercisePercent: 60 }));

        assert.notProperty(parsed, "testFreshExercisePercent");
    });

    it("uses caller-provided configurable parameters when given", () => {

        const delegate = new PostModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq({
            ...validBody,
            practiceSessionSize: 10,
            testUnlockDelayHours: 2,
            testRetryDelayMinutes: 30,
            testPassThreshold: 90,
            testQuestionCount: 15,
        }));

        assert.equal(parsed.practiceSessionSize, 10);
        assert.equal(parsed.testUnlockDelayHours, 2);
        assert.equal(parsed.testRetryDelayMinutes, 30);
        assert.equal(parsed.testPassThreshold, 90);
        assert.equal(parsed.testQuestionCount, 15);
    });

    it("throws 400 when id is missing", () => {

        const delegate = new PostModule({} as any, {} as any);
        const { id: _id, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /id/i);
    });

    it("throws 400 when title is missing", () => {

        const delegate = new PostModule({} as any, {} as any);
        const { title: _t, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /title/i);
    });

    it("throws 400 when theme is missing", () => {

        const delegate = new PostModule({} as any, {} as any);
        const { theme: _th, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /theme/i);
    });

    it("throws 400 when communicationGoal is missing", () => {

        const delegate = new PostModule({} as any, {} as any);
        const { communicationGoal: _cg, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /communicationGoal/i);
    });

    it("throws 400 when cefrLevel is missing", () => {

        const delegate = new PostModule({} as any, {} as any);
        const { cefrLevel: _cl, ...body } = validBody;

        assert.throws(() => delegate.parseRequest(makeReq(body)), /cefrLevel/i);
    });

    it("throws 400 when cefrLevel is an invalid value", () => {

        const delegate = new PostModule({} as any, {} as any);

        assert.throws(() => delegate.parseRequest(makeReq({ ...validBody, cefrLevel: "Z9" })), /cefrLevel/i);
    });

});

