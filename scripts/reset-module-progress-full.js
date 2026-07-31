/**
 * Fully resets a user's progress on one module — status, practice ladder, and module test
 * history — back to "never started". Unlike reset-module-practice.js (which deliberately
 * skips completed modules, since a passed module is inert on the ladder in production), this
 * script targets a completed module on purpose: it exists for manually re-testing a module
 * end-to-end (Grammar -> Practice -> Test) after its exercise bank is regenerated, in a dev
 * environment.
 *
 * What it does, for every progress record of the target module (status is NOT filtered):
 *   status                   -> "available"
 *   startedAt                -> null
 *   completedAt              -> null
 *   currentRung              -> 1
 *   rungCoverage             -> []
 *   practiceCompletedAt      -> null   (clears the derived testUnlocksAt)
 *   testAttempts             -> []     (embedded summaries on UserModuleProgress)
 *   vocabularyItemsPracticed -> unset  (legacy field from before the ladder)
 *
 * Also deletes the full ModuleTestAttempt documents for this user+module from the separate
 * moduleTestAttempts collection, so a stale attempt can't be looked up by a leftover id.
 *
 * Also deletes every PracticeSession document for this user+module (practiceSessions
 * collection), completed or not. This matters more than it looks: StartPracticeSession
 * returns 409 (and the client resumes the existing session) whenever an *active*
 * (completedAt: null) session already exists for the user+module — a stale in-progress
 * session from before the bank regeneration would otherwise get silently resumed, with the
 * client replaying its old answers log against exercise ids that may no longer exist. That is
 * why practice can appear "already half-through" right after a reset that only touched
 * userModuleProgress.
 *
 * What it deliberately does NOT touch:
 *   - UserVocabularyProgress / UserGrammarConceptProgress — mastery is global and per-item,
 *     not module-scoped, so resetting one module's progress does not reset mastery scores.
 *
 * Usage (defaults: MODULE_ID "danish-A2-01", DRY_RUN true — edit the vars below to change them):
 *   mongo "<connection-string>/tomelang" scripts/reset-module-progress-full.js
 *
 * Or override from the command line with --eval, which runs before the file. Values passed
 * this way must use `var` (not `const`/`let`) so this script's own `var` declarations below
 * don't collide with them:
 *   mongo --host <host> -u <user> --eval 'var DRY_RUN = false; var MODULE_ID = "danish-A2-02";' tomelang scripts/reset-module-progress-full.js
 *
 * DRY_RUN is true by default: it prints the records that would change and deletes nothing.
 * Set it to false (directly below, or via --eval above) to apply. Intended for dev use —
 * think twice before pointing this at prod.
 */

var MODULE_ID = (typeof MODULE_ID !== "undefined") ? MODULE_ID : "danish-A2-01";
var DRY_RUN = (typeof DRY_RUN !== "undefined") ? DRY_RUN : true;

const dbHandle = db.getSiblingDB("tomelang");
const progressCollection = dbHandle.getCollection("userModuleProgress");
const attemptsCollection = dbHandle.getCollection("moduleTestAttempts");
const sessionsCollection = dbHandle.getCollection("practiceSessions");

const filter = { moduleId: MODULE_ID };

const matched = progressCollection.find(filter).toArray();

print("");
print("=".repeat(70));
print(`Full progress reset — ${MODULE_ID}`);
print(`Mode: ${DRY_RUN ? "DRY RUN (nothing will be written)" : "APPLY"}`);
print("=".repeat(70));
print(`Progress records for this module: ${matched.length}`);
print("");

if (matched.length === 0) {
    print("Nothing to reset. Check the module id and that a progress record exists.");
    quit(0);
}

let totalAttemptDocs = 0;
let totalSessionDocs = 0;

for (const doc of matched) {

    const attemptDocCount = attemptsCollection.countDocuments({ userId: doc.userId, moduleId: MODULE_ID });
    totalAttemptDocs += attemptDocCount;

    const sessionDocCount = sessionsCollection.countDocuments({ userId: doc.userId, moduleId: MODULE_ID });
    const activeSessionCount = sessionsCollection.countDocuments({ userId: doc.userId, moduleId: MODULE_ID, completedAt: null });
    totalSessionDocs += sessionDocCount;

    print("-".repeat(70));
    print(`userId:              ${doc.userId}`);
    print(`status:              ${doc.status}`);
    print(`startedAt:           ${doc.startedAt || null}`);
    print(`completedAt:         ${doc.completedAt || null}`);
    print(`currentRung:         ${doc.currentRung || "(absent — pre-ladder record)"}`);
    print(`rungCoverage:        ${JSON.stringify((doc.rungCoverage || []).map(c => ({ rung: c.rung, items: (c.itemIds || []).length, completedAt: c.completedAt })))}`);
    print(`practiceCompletedAt: ${doc.practiceCompletedAt || null}`);
    print(`testAttempts (embedded): ${(doc.testAttempts || []).length}`);
    print(`moduleTestAttempts docs to delete: ${attemptDocCount}`);
    print(`practiceSessions docs to delete: ${sessionDocCount} (${activeSessionCount} active — this is what causes "already half-through")`);
}

print("-".repeat(70));
print("");

if (DRY_RUN) {
    print("DRY RUN — no changes written. Set DRY_RUN = false to apply.");
    quit(0);
}

const updateResult = progressCollection.updateMany(filter, {
    $set: {
        status: "available",
        startedAt: null,
        completedAt: null,
        currentRung: 1,
        rungCoverage: [],
        practiceCompletedAt: null,
        testAttempts: [],
    },
    $unset: { vocabularyItemsPracticed: "" },
});

const deleteResult = attemptsCollection.deleteMany({ moduleId: MODULE_ID });
const sessionDeleteResult = sessionsCollection.deleteMany({ moduleId: MODULE_ID });

print(`Progress records matched:  ${updateResult.matchedCount}`);
print(`Progress records modified: ${updateResult.modifiedCount}`);
print(`Test attempt docs deleted: ${deleteResult.deletedCount} (expected ${totalAttemptDocs})`);
print(`Practice session docs deleted: ${sessionDeleteResult.deletedCount} (expected ${totalSessionDocs})`);
print("");
print("Done. The module is back to 'available' — Grammar, Practice and the Module Test can");
print("all be run again from scratch against the regenerated bank.");
print("");
