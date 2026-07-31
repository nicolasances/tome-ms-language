# Scripts

One-off operational scripts. These are not part of the service runtime and are never executed by it.

| Script | Purpose |
|---|---|
| [`reset-module-practice.js`](./reset-module-practice.js) | Resets a module's practice progress back to rung 1 of the practice ladder ([F10](../docs/features/F10-practice-session.md)), for use after a module's exercise bank is regenerated. Skips completed modules. |
| [`reset-module-progress-full.js`](./reset-module-progress-full.js) | Fully resets a module back to "available" — status, practice ladder, and module test history — including completed modules. Dev-only, for manually re-testing a module end-to-end after its bank is regenerated. |

## `reset-module-practice.js`

Run with `mongosh`:

```bash
mongosh "<connection-string>/tomelang" scripts/reset-module-practice.js
```

`DRY_RUN` is `true` at the top of the file, so the first run only reports what would change. Read
the output, then set `DRY_RUN = false` and run it again to apply.

**When you need it.** A module's exercise bank is regenerated under new rules and the user should
re-run the whole practice ladder against the new bank rather than keep progress earned against the
old one. Written for A2-04 (issue #91 §6): practice was completed under the old one-exposure gate
but the module test had not been taken, so clearing `practiceCompletedAt` puts it back at rung 1 and
re-locks the test.

**What it skips.** Records whose `status` is `completed` — a passed module is inert on the ladder,
so A2-01…A2-03 and all of A1 are left alone. Mastery scores are module-independent and are not
touched: they survive the regeneration deliberately.

## `reset-module-progress-full.js`

Works with either `mongosh` or the legacy `mongo` shell (no ES2020 syntax — no `??`/`?.`).

Run with the defaults (`MODULE_ID` = `danish-A2-01`, `DRY_RUN` = `true`) by editing the vars at
the top of the file, or override from the command line with `--eval`, which runs before the file:

```bash
# Edit-the-file style
mongo "<connection-string>/tomelang" scripts/reset-module-progress-full.js

# --eval style — note `var`, not `const`/`let`, so it doesn't collide with the script's own vars
mongo --host <host> -u <user> --eval 'var DRY_RUN = false; var MODULE_ID = "danish-A2-02";' tomelang scripts/reset-module-progress-full.js
```

`DRY_RUN` is `true` by default — read the output, then set `DRY_RUN = false` (either way above) and
run again to apply.

**When you need it.** You want to manually re-run a module — Grammar, Practice, and the Module
Test — from scratch against a regenerated exercise bank, including a module whose status is
already `completed`. `reset-module-practice.js` intentionally won't touch a completed module (a
passed module is inert on the ladder in production); this script exists for the dev-only case of
deliberately re-testing one anyway.

**What it does.** Unlike `reset-module-practice.js`, `status` is **not** filtered — every progress
record for the module is reset to `status: "available"`, `startedAt`/`completedAt`/
`practiceCompletedAt` cleared, `currentRung` back to 1, `rungCoverage` cleared, embedded
`testAttempts` cleared, the full `ModuleTestAttempt` documents for that user+module deleted from
`moduleTestAttempts`, **and every `practiceSessions` document for that user+module deleted too**.
That last one matters more than it looks: `StartPracticeSession` resumes (409 + client replay)
any *active* (`completedAt: null`) session it finds for the user+module, so a stale in-progress
session left over from before a reset gets silently resumed — practice looks "already
half-through" even though `userModuleProgress` was reset correctly. Mastery
(`UserVocabularyProgress` / `UserGrammarConceptProgress`) is left untouched — it is global and
per-item, not module-scoped.

**Use with care.** This is meant for dev. Think twice before pointing it at prod — it discards a
passed module test.
