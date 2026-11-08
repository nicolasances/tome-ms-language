# F24 — Activity Stats (Rolling Window)

![Status](https://img.shields.io/badge/status-implemented-brightgreen?style=flat-square)

## 1. Purpose & Scope

Exposes the per-day learning-activity counts the app needs to render the Home
Dashboard's **"This week"** chart — a **rolling 7-day window: the last 6 days
plus today** (idea §3.5 "Weekly Activity"; `tome` feature `01-home-dashboard`).
The window always ends on **today**, so the view consistently shows the user's
most recent week of effort regardless of which weekday it is — it is **not** a
fixed calendar week (Mon–Sun).

This is a **read-only aggregate** over activity already recorded by other
features. It introduces no new collection: it counts existing
`PracticeSession` (F10), `ModuleTestAttempt` (F11), `LevelTestAttempt` (F21)
and `WordsPracticeSession` (F26) documents and buckets them per day.

For each day in the window the endpoint reports **four** counts, so the same
endpoint can back richer dashboard widgets later without a new round-trip:

- **Module practice sessions completed** that day (F10).
- **Successful (passed) module tests** that day (F11).
- **Successful (passed) level tests** that day (F21).
- **Words Practice sessions completed** that day (F26).

The Home Dashboard's "This week" chart stacks all four counts, one segment per
count.

**Out of scope**:
- The Home Dashboard UI / bar chart itself — owned by the `tome` app
  (`01-home-dashboard`); this feature only serves the data.
- Recording sessions/attempts (→ [F10](./F10-practice-session.md),
  [F11](./F11-module-test.md), [F21](./F21-level-test.md),
  [F26](./F26-words-practice-session.md)); this feature only
  **reads** what they persist.
- Streaks, all-time totals, calendar-month/year rollups, leaderboards — not
  needed by any current consumer.
- Per-module / per-level breakdowns — the counts are aggregated across all of
  the user's modules and levels.

---

## 2. Key Endpoints

**Summary of Endpoints:**

| Endpoint Type | Method | URL Path | Description |
|---------------|--------|----------|-------------|
| API | GET | `/me/stats/dailyActivity` | Per-day activity counts over the rolling 7-day window ending today |

### Endpoint: GET `/me/stats/dailyActivity`

**Description:**
Returns per-day activity counts for a **7-day window**: the day given by `from`
and the six following days, i.e. `from` through `from + 6`. Used by the Home
Dashboard with `from = today − 6` so the last bucket is today.

The user is taken from the **auth token** (`userContext.userId`); the `/me`
prefix denotes the authenticated principal — consistent with `GET /me/progress`.
There is no `:userId` in the path.

**Query parameters:**

| Param | Required | Format | Description |
|-------|----------|--------|-------------|
| `from` | No (defaults to `today − 6`) | `YYYYMMDD` | First day of the window. The window is always `from`..`from + 6` (7 days). When omitted, defaults to six days before today (in the service reference timezone) so the window ends today. |

**Response (200):** exactly **7** day entries, ordered **oldest → today**:

```json
{
  "from": "20260621",
  "to": "20260627",
  "days": [
    { "date": "20260621", "practiceSessions": 0, "successfulModuleTests": 0, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260622", "practiceSessions": 2, "successfulModuleTests": 0, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260623", "practiceSessions": 1, "successfulModuleTests": 1, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260624", "practiceSessions": 0, "successfulModuleTests": 0, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260625", "practiceSessions": 3, "successfulModuleTests": 0, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260626", "practiceSessions": 0, "successfulModuleTests": 0, "successfulLevelTests": 0, "wordsPracticeSessions": 0 },
    { "date": "20260627", "practiceSessions": 1, "successfulModuleTests": 0, "successfulLevelTests": 1, "wordsPracticeSessions": 2 }
  ]
}
```

- Every day in the window is present, including days with **no activity**
  (counts `0`) — the client never has to fill gaps.
- `date`, `from`, `to` are `YYYYMMDD` strings; `to = from + 6`.

**Expected Use Case:**
The Home Dashboard (`tome` app, `01-home-dashboard`) loads this on page open via
`TomeLearningDashboardAPI.getWeeklySessionStats`, computing `from` client-side as
`today − 6` (`YYYYMMDD`). It renders one bar per `days[]` entry (oldest → today),
one stacked segment per count, today emphasised.

**Errors:**
- `400` — `from` present but not a valid `YYYYMMDD` date.
- `401` — no/invalid auth token (no `userContext.userId`).

---

## 4. Business Logic

- **Window** — the response always covers exactly 7 calendar days: `from`
  through `from + 6` inclusive. With `from = today − 6`, the last bucket is
  today (the "last 6 days + today" rolling window). The window is derived purely
  from `from`; it is independent of weekday and is never a Mon–Sun calendar week.
- **Day bucketing** — each session/attempt is assigned to the calendar day of
  its relevant timestamp, evaluated in the **service reference timezone** — a
  single configured value in `Config.ts` (default `Europe/Copenhagen`), **not**
  UTC and **not** per-user. A session is counted in exactly one day bucket.
- **`practiceSessions`** — count of the user's `PracticeSession` documents
  (F10) whose **`completedAt`** falls on that day. Only **completed** sessions
  count (an `in_progress`/abandoned session with `completedAt = null` is never
  counted). Practice has no pass/fail concept, so every completed session counts.
- **`successfulModuleTests`** — count of the user's `ModuleTestAttempt`
  documents (F11) with **`passed = true`** whose **`takenAt`** falls on that day.
  Failed or un-submitted attempts (`takenAt = null`) are not counted.
- **`wordsPracticeSessions`** — count of the user's `WordsPracticeSession`
  documents (F26) whose **`completedAt`** falls on that day. Only completed
  sessions count (`status = completed`); an open session is never counted.
- **`successfulLevelTests`** — count of the user's `LevelTestAttempt` documents
  (F21) with **`passed = true`** whose **`takenAt`** falls on that day. Failed or
  un-submitted attempts are not counted.
- **All counts are scoped to the authenticated user** (`userContext.userId`).
  Counts aggregate across all of the user's modules / levels — there is no
  per-module or per-level split.
- **Empty days are explicit** — every day in the window appears in `days[]` with
  zero counts when there was no qualifying activity. The endpoint never returns a
  sparse array.
- **Read-only** — this feature never mutates session, attempt, mastery, or
  progress state. It only reads and aggregates.

---

## 5. Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Path is **`GET /me/stats/dailyActivity?from=YYYYMMDD`**, user resolved from the **auth token** (not a `:userId` path param). | `/me`-scoped (matches the `/me/progress` "me from token" pattern); the window is a query filter (`from`), not baked into the path; "activity" (not "sessions") because the payload spans practice + module tests + level tests; "daily" makes the bucket granularity explicit. **Supersedes** the earlier `tome`-side `GET /sessions/stats/weekly` contract — the `tome` Home Dashboard consumer (`01-home-dashboard`, `getWeeklySessionStats`) must be updated to this path. |
| 2 | Return **four** per-day counts (module practice, passed module tests, passed level tests, Words Practice sessions). | Cheap to compute alongside; one round-trip backs the whole stacked chart. `wordsPracticeSessions` is a **separate** count rather than folded into `practiceSessions`, so the chart can show it as its own segment and `practiceSessions` keeps meaning "module practice" (Words Practice idea, 2026-11-08). |
| 3 | **No new collection / store.** Add a per-day aggregation method to each of the four owning stores (`PracticeSessionStore`, `ModuleTestAttemptStore`, `LevelTestAttemptStore`, `WordsPracticeSessionStore` from F26); the delegate composes the four results into the 7-day grid. | The data already lives in those collections; the coding standard is one store per collection, so the aggregation belongs in each owning store, not a new one. |
| 4 | Aggregate per day using a **single fixed service reference timezone**, held as a `Config.ts` value (default `Europe/Copenhagen`, via the already-present `moment-timezone`) — not UTC and not a per-user timezone. | Timestamps are stored as UTC ISO strings; bucketing needs a consistent civil-day boundary. The `User` model carries no timezone and `toto` is a single-region personal app, so one configured tz gives stable, intuitive day boundaries (resolves OQ-01). |
| 5 | Compute the 7-day grid in the delegate: build all 7 `YYYYMMDD` keys from `from`, then left-join the store aggregations, filling missing days with zeros. | Guarantees a dense, fixed-length, oldest→today response regardless of which days had activity. |
| 6 | `from` is optional and defaults to `today − 6` (reference tz). | Makes the endpoint usable without the client computing the window, while preserving the dashboard's explicit `from`. |
| 7 | **Window length is fixed at 7 days** — no `to`/`days` param. | No consumer needs another length; a rolling week is the whole point of the endpoint. Add a param only when a consumer requires it (resolves OQ-02). |
| 8 | **Per-day counts only — no window-level `totals` object.** The Home Dashboard headline ("sessions this week") is the client-side sum of `days[].practiceSessions + days[].wordsPracticeSessions`. | Keeps the payload lean and avoids maintaining a redundant aggregate that must stay consistent with `days[]`; summing 7 numbers client-side is trivial. |

---

## 6. Success Criteria

| # | Criterion | Notes |
|---|-----------|-------|
| 1 | `GET /me/stats/dailyActivity?from=YYYYMMDD` returns exactly 7 day entries, ordered oldest → today, with `to = from + 6`. | Fixed-length window. |
| 2 | `practiceSessions` for a day equals the number of the user's `PracticeSession`s completed (`completedAt`) on that day; in-progress sessions are excluded. | F10. |
| 3 | `successfulModuleTests` for a day equals the number of the user's `passed = true` `ModuleTestAttempt`s with `takenAt` on that day; failed/un-submitted excluded. | F11. |
| 4 | `successfulLevelTests` for a day equals the number of the user's `passed = true` `LevelTestAttempt`s with `takenAt` on that day; failed/un-submitted excluded. | F21. |
| 4b | `wordsPracticeSessions` for a day equals the number of the user's `WordsPracticeSession`s completed (`completedAt`) on that day; open sessions excluded. | F26. |
| 5 | Days with no activity appear with all counts `0`; the array is never sparse. | Dense window. |
| 6 | Counts are scoped to the authenticated user; another user's activity is never included. | Auth-token ownership. |
| 7 | Omitting `from` returns the window ending today; an invalid `from` returns 400. | Default + validation. |
| 8 | All session/attempt/progress state is unchanged after the call. | Read-only. |

---

## 7. Open Questions

All open questions resolved.

| # | Question | Resolution |
|---|----------|-----------|
| OQ-01 | Which reference timezone defines a "day" for bucketing? | **Resolved** — a single configured timezone held in `Config.ts` (default `Europe/Copenhagen`), not UTC and not per-user. Revisit only if per-user timezones are introduced. |
| OQ-02 | Should the window length be configurable (e.g. a `to`/`days` param) rather than fixed at 7? | **Resolved** — fixed at 7 days; no length param until a consumer needs one. |
| OQ-03 | Should `practiceSessions` count *completed* sessions or *distinct days/modules practiced*? | **Resolved** — count completed sessions (one bar height = sessions completed that day), matching the dashboard spec. |
| OQ-04 | Should the response carry a window-level `totals` summary? | **Resolved** — no; per-day counts only, the client sums for the headline figure. |
