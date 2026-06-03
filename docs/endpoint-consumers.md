# Endpoint Consumers & UI Flows

This document maps every endpoint exposed by `tome-ms-language` to its **expected consumer**, using the [language-learning idea](../../tome/docs/specs/language-learning/idea.md) and the UI wireframe (`tome/docs/ui-design/wireframe.html`) as the source of truth. It is reference context for designing and building the features — when adding a feature, use this to decide *who* calls a given endpoint and *why* it exists.

## Consumer types

| Type | Meaning |
|------|---------|
| **frontend** | Rendered or triggered directly by a screen in the `tome` webapp |
| **internal** | Called by another feature **within this same microservice** as part of an orchestrated flow |
| **external** | Called by another microservice or an external tool (seeding generator, content-analysis tool) |
| **seeding** | Content-load endpoint used (typically once) by the development/seeding tool |

> A single endpoint can have more than one consumer. The table records the *primary expected* consumer(s).

---

## 1. Wireframe flows → endpoints

The wireframe covers four flows. Each lists the backend endpoints the screen depends on.

### 1.1 Home dashboard

Surfaces the CEFR level (the motivational anchor), per-level module progress, a continue-module card, and quick actions (Modules / Analyze / Knowledge).

| UI element | Endpoint(s) |
|------------|-------------|
| CEFR level badge / ring ("A1 · Foundation") + level rollup ("11 to reach A2") | `GET /me/progress` (F07) |
| Module progress ("1 / 12 modules") | `GET /me/progress` (F07) |
| Continue card (module title, current step, % bar) | `GET /me/progress` (F07) + `GET /modules/:id` (F03) for title |

> **Note:** the dashboard's "This week" activity chart is **UI-only**. There is no backend source for it and none is planned for v2.0; it is not backed by any endpoint.
>
> **Aggregate read:** `GET /me/progress` is a single BFF-style read that returns the CEFR rollup across levels plus the per-module list for the viewed level (status, step, %, and — for the in-progress module — test-unlock timestamps). It replaces the former `GET /me/moduleProgress`, `GET /me/moduleProgress?cefrLevel`, and `GET /me/moduleProgress/:moduleId`. Live in-session practice state stays in F10's own session endpoint.

### 1.2 Module map

Lists all modules at the user's level with their per-user status; the in-progress module shows its step and progress bar.

| UI element | Endpoint(s) |
|------------|-------------|
| Module titles / codes for the level | `GET /modules?cefrLevel=A1` (F03) |
| Per-module status overlay (locked / in_progress / %) | `GET /me/progress?cefrLevel=A1` (F07) |

The app joins these two responses client-side.

### 1.3 Module flow (overview → grammar intro → practice → test)

| UI element | Endpoint(s) |
|------------|-------------|
| Module overview: title, description, grammar chips, word count, steps | `GET /modules/:id` (F03) + `GET /me/progress` (F07) |
| Test-lock state ("4h after practice") | timestamps from `GET /me/progress` (F07), surfaced from F11; client renders the countdown locally |
| Grammar intro (concept name, explanation, Danish examples) | `GET /modules/:moduleId/grammarIntroduction` (F09) |

### 1.4 Practice exercises (6 types) and module test

| UI element | Endpoint(s) |
|------------|-------------|
| Start practice → get the ordered exercises | `POST /users/:userId/modules/:moduleId/practiceSessions` (F10) |
| Session state / resume | `GET /users/:userId/practiceSessions/:sessionId` (F10) |
| Submit an answer | `POST /users/:userId/practiceSessions/:sessionId/answers` (F10) |
| Finish the session | `POST /users/:userId/practiceSessions/:sessionId/complete` (F10) |
| "Explain my mistake" (after a wrong answer) | `POST /exercises/:exerciseId/explainMistake` (F12) |
| Translation answer re-check (wrong translation) | `POST /exercises/:exerciseId/verifyAnswer` (F13) |
| Take the module test (start / submit / review) | `POST .../modules/:moduleId/tests`, `POST .../moduleTests/:attemptId/submit`, `GET .../moduleTests/:attemptId/review` (F11) |

---

## 2. Master endpoint matrix

Grouped by feature. "Consumer" is the expected caller per the idea + wireframe.

### F01 — Vocabulary Catalog
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/vocabularyItems` | POST | seeding / frontend | Seeded by the generator; also reused by F22 (user-added words) |
| `/vocabularyItems/batch` | POST | seeding | Bulk seed |
| `/vocabularyItems/:id` | GET | frontend | Resolve a word for display |
| `/vocabularyItems` | GET | frontend / external | List by level |
| `/vocabularyItems/lookup` | POST | frontend / internal | Bulk-resolve ids referenced by a module |

### F02 — Grammar Concept Catalog
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/grammarConcepts` | POST | seeding | |
| `/grammarConcepts/batch` | POST | seeding | |
| `/grammarConcepts/:id` | GET | frontend | |
| `/grammarConcepts` | GET | frontend / external | |
| `/grammarConcepts/lookup` | POST | internal | Bulk-resolve ids (used by F09 grammar intro) |

### F03 — Module Catalog
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/modules` | POST | seeding / external | Default-module seeding + user-generated modules |
| `/modules/:id` | GET | frontend | Module overview |
| `/modules` | GET | frontend | Module map (list by level) |

### F04 — Exercise Bank
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/exerciseBanks` | POST | seeding / external | Create a module's bank |
| `/exerciseBanks/:moduleId/exercises` | POST | external | Bank refresh (async generator) |
| `/exerciseBanks/:moduleId` | GET | internal | Read by selection (F08) |
| `/exercises/:id` | GET | frontend / internal | Render / score an exercise |
| `/exercises` | GET | internal | List by module (selection) |
| `/exercises/:id/timesShown` | PUT | internal | Incremented by F10/F11 as exercises are shown |
| `/exercises/:id/userContributedAnswers` | PUT | internal | Appended by F13 after a verified translation |

### F05 — User Profile & CEFR Level
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/users` | POST | frontend | First-run registration (idempotent) |
| `/me` | GET | frontend | Lean profile read; the dashboard aggregate is `GET /me/progress` (F07) |
| `/me/cefrLevel` | PUT | frontend | Advance level after a Level Test pass (F21) |

### F06 — Mastery & Progress Tracking (SRS)
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/users/:userId/vocabularyProgress/applyResults` | POST | internal | Called by F11/F21 after a graded test |
| `/users/:userId/grammarProgress/applyResults` | POST | internal | Called by F11/F21 after a graded test |
| `/users/:userId/vocabularyProgress` | GET | frontend / internal | Mastery records; used by selection (F08) and "my words" views |
| `/users/:userId/vocabularyProgress/:vocabularyItemId` | GET | frontend | Per-word mastery (US-05) |
| `/users/:userId/grammarProgress` | GET | frontend / internal | Used by selection (F08) |
| `/users/:userId/grammarProgress/:grammarConceptId` | GET | frontend | Per-concept mastery |

### F07 — User Module Progress
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/me/progress` | GET | frontend | Aggregate read: CEFR rollup across levels + per-module list for the viewed level (`?cefrLevel` optional, defaults to current). Carries test-unlock timestamps for the in-progress module. Powers the Home dashboard, module map, and module overview |
| `/me/levelProgress` | GET | internal | Completion gate read by F21 |
| `/me/moduleProgress/:moduleId` | PUT | internal | Status transition driven by F10 (start) / F11 (pass) |
| `/me/moduleProgress/:moduleId/testAttempts` | POST | internal | Attempt record appended by F11 |

### F08 — Mastery-Aware Exercise Selection
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| _(no endpoint — selection algorithm)_ | — | internal | Invoked by F10 / F11 / F21 |

### F09 — Grammar Introduction (Step 1)
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/modules/:moduleId/grammarIntroduction` | GET | frontend | Grammar intro screen |

### F10 — Practice Session (Step 2)
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/users/:userId/modules/:moduleId/practiceSessions` | POST | frontend | Start practice |
| `/users/:userId/practiceSessions/:sessionId` | GET | frontend | Resume / session state |
| `/users/:userId/practiceSessions/:sessionId/answers` | POST | frontend | Submit one answer |
| `/users/:userId/practiceSessions/:sessionId/complete` | POST | frontend | Finish session |

### F11 — Module Test (Step 3)
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/users/:userId/modules/:moduleId/testEligibility` | GET | internal / frontend | Authoritative unlock gate enforced by test-start. The overview countdown reads the timestamps from `GET /me/progress` (F07) instead of polling this; available for an explicit re-check |
| `/users/:userId/modules/:moduleId/tests` | POST | frontend | Start test attempt |
| `/users/:userId/moduleTests/:attemptId/submit` | POST | frontend | Submit all answers |
| `/users/:userId/moduleTests/:attemptId/review` | GET | frontend | Result + review screen |

### F12 — Explain My Mistake
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/exercises/:exerciseId/explainMistake` | POST | frontend | On-demand after a wrong answer |

### F13 — Translation Answer Verification
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/exercises/:exerciseId/verifyAnswer` | POST | frontend | On-demand re-check of a wrong translation |

### F20 — Level Test Bank
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/levelTestBanks` | POST | seeding / external | |
| `/levelTestBanks/:cefrLevel/exercises` | POST | external | Bank refresh |
| `/levelTestBanks/:cefrLevel` | GET | internal | Read by selection (F08) for F21 |

### F21 — Level Test
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/users/:userId/levelTest/eligibility` | GET | frontend | Whether the Level Test is available |
| `/users/:userId/levelTests` | POST | frontend | Start Level Test attempt |
| `/users/:userId/levelTests/:attemptId/submit` | POST | frontend | Submit answers |
| `/users/:userId/levelTests/:attemptId` | GET | frontend | Result + weak-areas summary |

### F22 — User-Added Vocabulary
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/vocabularyItems` (source=user_added) | POST | frontend | Add a word; also written by F23's "add unknown vocabulary" action |
| `/users/:userId/addedVocabulary` | GET | frontend | List the user's added words |

### F23 — Content Analysis Report
| Endpoint | Method | Consumer | Notes |
|----------|--------|----------|-------|
| `/contentReports` | POST | external | Submitted by the external analysis tool |
| `/contentReports/:id` | GET | frontend | View a report |
| `/users/:userId/contentReports` | GET | frontend | List a user's reports |

---

## 3. Summary by consumer

- **frontend** — the endpoints the `tome` webapp renders or triggers: the aggregate `GET /me/progress` and the read endpoints across F03/F05/F06, the grammar intro (F09), the full practice and test loops (F10/F11/F21), the on-demand AI touchpoints (F12/F13), user-added vocabulary (F22), and content-report views (F23).
- **internal** — orchestration plumbing called by other features in this service: mastery `applyResults` (F06), module-progress writes (F07), exercise bookkeeping (F04 `timesShown`, `userContributedAnswers`), the completion gate (`/me/levelProgress`), bank reads (F04/F20), and the selection algorithm (F08).
- **external** — catalog/bank seeding and the content-analysis submission (`POST /contentReports`).
- **seeding** — the catalog and bank `POST` endpoints loaded by the development/seeding tool.

> This classification is derived from the idea and the wireframe, not from the current `src/` implementation. Confirming how the internal flows actually invoke one another in code is a separate, later exercise.
