import { assert } from "chai";
import { GetGrammarIntroduction } from "../../../src/dlg/modules/GetGrammarIntroduction";
import { Module } from "../../../src/model/Module";
import { GrammarConcept } from "../../../src/model/GrammarConcept";

function makeMockConfig(moduleDoc: any | null, conceptDocs: any[]) {

    const collections: Record<string, any> = {
        modules: {
            findOne: async (filter: any) => (moduleDoc && moduleDoc.id === filter.id ? moduleDoc : null),
        },
        grammar: {
            find: (filter: any) => ({
                toArray: async () => conceptDocs.filter(d => (filter.id?.$in ?? []).includes(d.id)),
            }),
        },
    };

    return {
        getDBName: () => "test",
        getMongoDb: async () => ({ collection: (name: string) => collections[name] }),
    } as any;
}

function makeModuleBSON(grammarConceptIds: string[]): any {
    return new Module({
        id: "mod-01",
        title: "Test Module",
        theme: "daily life",
        communicationGoal: "greet people",
        cefrLevel: "A1",
        grammarConceptIds,
    }).toBSON();
}

function makeConceptBSON(id: string, name: string): any {
    return new GrammarConcept({
        id,
        name,
        category: "tenses",
        cefrLevelIntroduced: "A1",
        explanation: `Explanation for ${name}`,
        examples: [{ danish: "Hej", english: "Hello" }],
    }).toBSON();
}

describe("GetGrammarIntroduction.do", () => {

    it("returns concepts in grammarConceptIds order even when the collection returns them out of order", async () => {

        const moduleDoc = makeModuleBSON(["gc-A", "gc-B", "gc-C"]);
        const conceptDocs = [
            makeConceptBSON("gc-C", "Concept C"),
            makeConceptBSON("gc-A", "Concept A"),
            makeConceptBSON("gc-B", "Concept B"),
        ];

        const config = makeMockConfig(moduleDoc, conceptDocs);
        const delegate = new GetGrammarIntroduction({} as any, config);

        const result = await delegate.do({ moduleId: "mod-01" });

        assert.equal(result.concepts.length, 3);
        assert.equal(result.concepts[0].name, "Concept A");
        assert.equal(result.concepts[1].name, "Concept B");
        assert.equal(result.concepts[2].name, "Concept C");
    });

    it("returns empty concepts array when module has no grammarConceptIds", async () => {

        const moduleDoc = makeModuleBSON([]);
        const config = makeMockConfig(moduleDoc, []);
        const delegate = new GetGrammarIntroduction({} as any, config);

        const result = await delegate.do({ moduleId: "mod-01" });

        assert.deepEqual(result.concepts, []);
    });

    it("throws 404 when module is not found", async () => {

        const config = makeMockConfig(null, []);
        const delegate = new GetGrammarIntroduction({} as any, config);

        try {

            await delegate.do({ moduleId: "non-existent" });

            assert.fail("Expected an error to be thrown");

        } catch (err: any) {

            assert.equal(err.code, 404);
        }
    });

});
