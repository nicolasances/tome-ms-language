# Change: Remove internal-only PUT /me/moduleProgress/:moduleId endpoint   (2026-06-08)

## What changed
- **F07 (User Module Progress)** — `PUT /me/moduleProgress/:moduleId` is removed as a REST endpoint. Its status-transition logic (idempotent `startedAt`/`completedAt`/`practiceCompletedAt` handling + upsert) moves into a new `UserModuleProgressStore.transitionStatus(...)` method that F10 and F11 call directly, in-process — mirroring how those same delegates already consume `appendTestAttempt` / `appendPracticedVocabulary`.

## Why
The Toto microservice coding standard requires: *"Only create REST endpoints when the endpoint needs to be consumed by an external consumer."* `docs/endpoint-consumers.md` lists the only consumers of this endpoint as **internal** — F10 (practice start) and F11 (test pass), both features of this same microservice. Every other same-service write/read against `UserModuleProgressStore` (`GetMeProgress`, `GetMeLevelProgress`, `PostMeModuleTestAttempt`, `PostMePracticedVocabulary`) already goes straight through the store, not through an HTTP self-call. Keeping `PUT /me/moduleProgress/:moduleId` as a REST endpoint is therefore both unnecessary (no genuine external caller) and inconsistent with the established pattern — it would force F10/F11 to make HTTP round-trips to their own service for something every sibling delegate already does in-process.

## Impact (add / modify / remove)

**F07 — User Module Progress**
- **Remove**: `PUT /me/moduleProgress/:moduleId` endpoint, its delegate (`PutMeModuleProgress`), and its route registration in `src/index.ts`.
- **Add**: `UserModuleProgressStore.transitionStatus(userId, moduleId, status, practiceCompletedAt?)` — encapsulates the upsert + idempotent-timestamp logic that lived in the delegate (`startedAt` set once on the first `in_progress` transition and never overwritten; `completedAt` set on `completed`; `practiceCompletedAt` carried through idempotently; `vocabularyItemsPracticed` / `testAttempts` preserved). Called directly, in-process, by F10 (on practice start) and F11 (on test pass).
- **Modify**: F07 doc — drop the `PUT /me/moduleProgress/:moduleId` row from the Endpoints section and describe the status transition as an internal store operation consumed in-process by F10/F11.

## Behavior to verify
- `UserModuleProgressStore.transitionStatus` creates the record on first call (status `in_progress`) with `startedAt` set, and does not move `startedAt` on subsequent calls.
- A `completed` transition sets `completedAt` and preserves `vocabularyItemsPracticed`, `practiceCompletedAt`, and `testAttempts`.
- No HTTP route exists any longer at `PUT /me/moduleProgress/:moduleId` (the app never called it directly — only F10/F11 did, internally).
- `docs/interfaces/api-endpoints.md` no longer lists this endpoint.

## Affected feature files
- [`F07-user-module-progress.md`](../F07-user-module-progress.md)
