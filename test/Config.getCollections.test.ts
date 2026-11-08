import { assert } from "chai";
import { ControllerConfig } from "../src/Config";

describe("ControllerConfig.getCollections", () => {

    it("returns all 13 collections currently in use by the service", () => {

        const config = new ControllerConfig({} as any);
        const collections = config.getCollections();

        assert.sameMembers(collections, [
            "exercises",
            "grammar",
            "modules",
            "levelTestBanks",
            "levelTestAttempts",
            "moduleTestAttempts",
            "practiceSessions",
            "userGrammarProgress",
            "userModuleProgress",
            "userVocabularyProgress",
            "users",
            "vocabulary",
            "wordsPracticeSessions",
        ]);
    });

    it("returns exactly 13 collections, no duplicates", () => {

        const config = new ControllerConfig({} as any);
        const collections = config.getCollections();

        assert.lengthOf(collections, 13);
        assert.lengthOf(new Set(collections), 13, "collection names must be unique");
    });
});
