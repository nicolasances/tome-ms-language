/**
 * Resets a module's practice progress back to rung 1 of the practice ladder (F10).
 *
 * Written for the A2-04 regeneration (issue #91 §6 / design OQ-04): A2-04 in prod is in a third
 * state — practice done under the old one-exposure gate, module test not yet taken. Its bank is
 * being regenerated under the per-rung coverage rules, so the old practice result is discarded and
 * the module re-runs the full ladder from rung 1 rather than being grandfathered in.
 *
 * What it does, for every non-completed progress record of the target module:
 *   currentRung             -> 1
 *   rungCoverage            -> []
 *   practiceCompletedAt     -> null   (this is what clears the derived testUnlocksAt)
 *   vocabularyItemsPracticed-> unset  (legacy field from before the ladder)
 *
 * What it deliberately does NOT touch:
 *   - status / startedAt / completedAt — the module stays in_progress and keeps its start date
 *   - testAttempts — attempt history is never rewritten
 *   - UserVocabularyProgress / UserGrammarConceptProgress — mastery is global and per-item, not
 *     module-scoped, so it survives a bank regeneration. The stale exercise ids left in
 *     exerciseHistory are append-only history and are never read for correctness.
 *   - completed modules — A2-01…A2-03 passed their test and are inert on the ladder. The
 *     status guard below is what keeps them out.
 *
 * Usage:
 *   mongosh "<connection-string>/tomelang" scripts/reset-module-practice.js
 *
 * DRY_RUN is true by default: it prints the records that would change and writes nothing.
 * Set it to false to apply.
 */

const MODULE_ID = "danish-A2-04";
const DRY_RUN = true;

const collection = db.getSiblingDB("tomelang").getCollection("userModuleProgress");

// Completed modules are inert on the ladder — never reset them.
const filter = { moduleId: MODULE_ID, status: { $ne: "completed" } };

const matched = collection.find(filter).toArray();

print("");
print("=".repeat(70));
print(`Reset module practice — ${MODULE_ID}`);
print(`Mode: ${DRY_RUN ? "DRY RUN (nothing will be written)" : "APPLY"}`);
print("=".repeat(70));

const allForModule = collection.countDocuments({ moduleId: MODULE_ID });

print(`Progress records for this module: ${allForModule}`);
print(`Records matching the reset filter:  ${matched.length}`);
print(`Skipped as completed:               ${allForModule - matched.length}`);
print("");

if (matched.length === 0) {
    print("Nothing to reset. Check the module id and that a progress record exists.");
    quit(0);
}

for (const doc of matched) {
    print("-".repeat(70));
    print(`userId:              ${doc.userId}`);
    print(`status:              ${doc.status}`);
    print(`currentRung:         ${doc.currentRung ?? "(absent — pre-ladder record)"}`);
    print(`rungCoverage:        ${JSON.stringify((doc.rungCoverage ?? []).map(c => ({ rung: c.rung, items: (c.itemIds ?? []).length, completedAt: c.completedAt })))}`);
    print(`practiceCompletedAt: ${doc.practiceCompletedAt ?? null}`);
    print(`legacy vocabularyItemsPracticed: ${(doc.vocabularyItemsPracticed ?? []).length} item(s)`);
    print(`testAttempts:        ${(doc.testAttempts ?? []).length} (preserved)`);
}

print("-".repeat(70));
print("");

if (DRY_RUN) {
    print("DRY RUN — no changes written. Set DRY_RUN = false to apply.");
    quit(0);
}

const result = collection.updateMany(filter, {
    $set: { currentRung: 1, rungCoverage: [], practiceCompletedAt: null },
    $unset: { vocabularyItemsPracticed: "" },
});

print(`Matched:  ${result.matchedCount}`);
print(`Modified: ${result.modifiedCount}`);
print("");
print("Done. The module is back at rung 1 and its module test is locked again until the");
print("full three-rung ladder is completed against the regenerated bank.");
print("");
