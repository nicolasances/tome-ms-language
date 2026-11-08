import { assert } from "chai";
import { ModuleStore } from "../../src/store/ModuleStore";
import { FakeDb } from "../helpers/FakeDb";

function moduleDoc(id: string): any {
    return { id, title: id, theme: "t", communicationGoal: "g", cefrLevel: "A1", vocabularyItemIds: [], grammarConceptIds: [] };
}

describe("ModuleStore.findByIds", () => {

    it("returns only the requested modules in one query", async () => {
        const store = new ModuleStore(new FakeDb({ modules: [moduleDoc("m1"), moduleDoc("m2"), moduleDoc("m3")] }) as any);

        const modules = await store.findByIds(["m1", "m3"]);

        assert.sameMembers(modules.map(m => m.id), ["m1", "m3"]);
    });
});
