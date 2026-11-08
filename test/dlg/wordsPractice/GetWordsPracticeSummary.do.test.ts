import { assert } from "chai";
import { ObjectId } from "mongodb";
import { GetWordsPracticeSummary } from "../../../src/dlg/wordsPractice/GetWordsPracticeSummary";
import { makeConfig, makeDb, moduleDoc, moduleProgressDoc, userContext, vocabDoc } from "./WordsPractice.fixtures";

describe("GetWordsPracticeSummary.do", () => {

    it("returns poolSize 0 and no open session when nothing is completed", async () => {
        const db = makeDb({ modules: [moduleDoc("m1", ["v1"])], vocabulary: [vocabDoc("v1", "hus")], userModuleProgress: [moduleProgressDoc("m1", "in_progress")] });

        const result = await new GetWordsPracticeSummary({} as any, makeConfig(db) as any).do({}, userContext as any);

        assert.deepEqual(result, { poolSize: 0, openSessionId: null });
    });

    it("counts distinct normalized Danish forms across completed modules of any level", async () => {
        const db = makeDb({
            modules: [moduleDoc("m1", ["v1", "v2"], "A1"), moduleDoc("m2", ["v3", "v4"], "B1"), moduleDoc("m3", ["v5"])],
            vocabulary: [vocabDoc("v1", "hus"), vocabDoc("v2", "bil"), vocabDoc("v3", "Hus"), vocabDoc("v4", "at arbejde"), vocabDoc("v5", "aldrig")],
            userModuleProgress: [moduleProgressDoc("m1", "completed"), moduleProgressDoc("m2", "completed"), moduleProgressDoc("m3", "in_progress")],
        });

        const result = await new GetWordsPracticeSummary({} as any, makeConfig(db) as any).do({}, userContext as any);

        assert.equal(result.poolSize, 3);
    });

    it("excludes user-added vocabulary items from the pool", async () => {
        const db = makeDb({
            modules: [moduleDoc("m1", ["v1", "v2"])],
            vocabulary: [vocabDoc("v1", "hus"), vocabDoc("v2", "bil", { source: "user_added" })],
            userModuleProgress: [moduleProgressDoc("m1", "completed")],
        });

        const result = await new GetWordsPracticeSummary({} as any, makeConfig(db) as any).do({}, userContext as any);

        assert.equal(result.poolSize, 1);
    });

    it("returns the id of the user's in_progress session", async () => {
        const oid = new ObjectId();
        const db = makeDb({ wordsPracticeSessions: [{ _id: oid, userId: "u1", status: "in_progress", startedAt: "x", completedAt: null, words: [], lastAnsweredWordKey: null }] });

        const result = await new GetWordsPracticeSummary({} as any, makeConfig(db) as any).do({}, userContext as any);

        assert.equal(result.openSessionId, oid.toString());
    });
});
