# Change: Add Activity Stats rolling-window endpoint   (2026-06-28)

## What changed
- **F24 — Activity Stats (Rolling Window)** (new feature) — adds a read-only
  aggregate endpoint `GET /me/stats/dailyActivity?from=YYYYMMDD` that returns
  per-day learning-activity counts over a rolling 7-day window (last 6 days +
  today): completed practice sessions, passed module tests, and passed level
  tests per day. New feature group **I — Activity & engagement stats**.
- No change to F10/F11/F21 behavior — F24 only **reads** the `PracticeSession`,
  `ModuleTestAttempt`, and `LevelTestAttempt` documents they already persist.

## Why
- The `tome` Home Dashboard (`01-home-dashboard`) already specifies a backend
  call (originally `GET /sessions/stats/weekly?from=YYYYMMDD`) served by
  `tome-ms-language` to draw its "This week" rolling-window bar chart (idea §3.5
  "Weekly Activity"), but **no `tome-ms-language` feature owned that endpoint** —
  it was an uncovered backend dependency. F24 fills that gap.
- The path was redesigned to `GET /me/stats/dailyActivity` (from the consumer's
  original `/sessions/stats/weekly`): `/me`-scoped like `/me/progress`, the
  window expressed as a query filter rather than a hardcoded "weekly", and named
  "activity" (not "sessions") since the payload spans practice **and** tests.
  **This supersedes the consumer contract** — the `tome` Home Dashboard
  (`getWeeklySessionStats`) must be updated to call the new path.
- The endpoint is specified to return **three** per-day counts (practice, passed
  module tests, passed level tests), not just practice, so the same call can back
  streaks and richer activity widgets later without a new round-trip. The
  dashboard's current chart consumes only the practice count.

## Impact (add / modify / remove)
- **F24 (add):** new endpoint `GET /me/stats/dailyActivity`; new per-day
  aggregation methods on the three existing stores (`PracticeSessionStore`,
  `ModuleTestAttemptStore`, `LevelTestAttemptStore`); a new delegate that builds
  the dense 7-day grid. No new collection / model.
- **README (modify):** new "Group I — Activity & engagement stats" and F24 added
  to the build order (Extended; depends on F10/F11/F21).
- **No removals.**

## Behavior to verify
- `GET /me/stats/dailyActivity?from=YYYYMMDD` returns exactly 7 day entries,
  oldest → today, `to = from + 6`, dense (no missing days; zero-filled).
- `practiceSessions[d]` = count of the auth user's `PracticeSession`s with
  `completedAt` on day `d`; in-progress (`completedAt = null`) excluded.
- `successfulModuleTests[d]` = count of the user's `ModuleTestAttempt`s with
  `passed = true` and `takenAt` on day `d`; failed/un-submitted excluded.
- `successfulLevelTests[d]` = count of the user's `LevelTestAttempt`s with
  `passed = true` and `takenAt` on day `d`; failed/un-submitted excluded.
- User resolved from the auth token (no `:userId` in path); another user's
  activity is never included.
- `from` omitted ⇒ window ends today; invalid `from` ⇒ 400. Window length is
  fixed at 7 days (no `to`/`days` param). Response is per-day only — **no**
  window-level `totals` object (client sums for the headline).
- Day bucketing uses a single configured service timezone (a `Config.ts` value,
  default `Europe/Copenhagen`), not UTC and not per-user; the call mutates no
  state.

## Affected feature files
- `docs/features/F24-activity-stats.md` (new)
- `docs/features/README.md` (group + build order)
