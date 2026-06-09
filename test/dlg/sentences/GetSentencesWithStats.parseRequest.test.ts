import { Request } from "express";
import { assert } from "chai";
import { GetSentencesWithStats } from "../../../src/dlg/sentences/GetSentencesWithStats";

function makeRequest(params: Record<string, string>, query: Record<string, string> = {}): Request {
    return { params, query, body: {} } as unknown as Request;
}

const delegate = new GetSentencesWithStats({} as any, {} as any);

describe("GetSentencesWithStats.parseRequest â€” sortBy / sortDir validation", () => {

    it("accepts no sortBy or sortDir and defaults to no sort", () => {
        const result = delegate.parseRequest(makeRequest({ language: "danish" }));
        assert.isUndefined(result.sortBy);
        assert.isUndefined(result.sortDir);
    });

    it("accepts sortBy=difficulty with sortDir=asc", () => {
        const result = delegate.parseRequest(makeRequest({ language: "danish" }, { sortBy: "difficulty", sortDir: "asc" }));
        assert.equal(result.sortBy, "difficulty");
        assert.equal(result.sortDir, "asc");
    });

    it("accepts sortBy=difficulty with sortDir=desc", () => {
        const result = delegate.parseRequest(makeRequest({ language: "danish" }, { sortBy: "difficulty", sortDir: "desc" }));
        assert.equal(result.sortBy, "difficulty");
        assert.equal(result.sortDir, "desc");
    });

    it("throws for an invalid sortBy value", () => {
        assert.throws(() => delegate.parseRequest(makeRequest({ language: "danish" }, { sortBy: "unknown" })));
    });

    it("throws for an invalid sortDir value", () => {
        assert.throws(() => delegate.parseRequest(makeRequest({ language: "danish" }, { sortBy: "difficulty", sortDir: "sideways" })));
    });
});

