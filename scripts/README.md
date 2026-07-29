# Scripts

One-off operational scripts. These are not part of the service runtime and are never executed by it.

| Script | Purpose |
|---|---|
| [`reset-module-practice.js`](./reset-module-practice.js) | Resets a module's practice progress back to rung 1 of the practice ladder ([F10](../docs/features/F10-practice-session.md)), for use after a module's exercise bank is regenerated. |

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
