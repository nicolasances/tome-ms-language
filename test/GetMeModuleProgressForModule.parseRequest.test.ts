import { assert } from "chai";
import { Request } from "express";
import { GetMeModuleProgressForModule } from "../src/dlg/GetMeModuleProgressForModule";

function makeReq(moduleId: string): Request {
    return { params: { moduleId }, query: {}, body: {} } as unknown as Request;
}

describe("GetMeModuleProgressForModule.parseRequest", () => {

    it("parses moduleId from route params", () => {
        const delegate = new GetMeModuleProgressForModule({} as any, {} as any);
        const parsed = delegate.parseRequest(makeReq("mod-42"));

        assert.equal(parsed.moduleId, "mod-42");
    });

    it("throws 400 when moduleId param is missing", () => {
        const delegate = new GetMeModuleProgressForModule({} as any, {} as any);
        assert.throws(() => delegate.parseRequest({ params: {}, query: {}, body: {} } as unknown as Request), /400|moduleId/i);
    });
});
