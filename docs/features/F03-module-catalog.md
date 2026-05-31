# F03 — Module Catalog

## 1. Purpose & Scope

A Module is a self-contained learning unit with a theme, a communication goal, a CEFR level, a referenced vocabulary set, and referenced grammar concepts. This feature defines the canonical Module entity and the write/read access used by external tools and the app. Modules reference vocabulary and grammar concepts **by id** rather than embedding them, so words/concepts can be reused across modules.

Modules are created by an **external tool** (a seeding script or a custom module generator) and submitted via POST endpoints. This microservice stores them and makes them queryable.

**Out of scope**:
- Per-user module status / progress (`locked`/`available`/…) (→ [F07](./F07-user-module-progress.md))
- The exercise bank attached to a module (→ [F04](./F04-exercise-bank.md))
- The execution flow (steps 1–3) (→ [F09](./F09-grammar-introduction.md), [F10](./F10-practice-session.md), [F11](./F11-module-test.md))

---

## 2. Core Concepts & Requirements

### 2.1. Core Concepts

| Term | Definition |
|------|-----------|
| Module | A themed learning unit: theme, communication goal, CEFR level, vocab set, grammar concepts |
| Default module | A curriculum module seeded by an external tool, shared by all users |
| User-generated module | A module created on demand for one user (`isUserGenerated = true`) |
| Configurable parameters | Per-module tuning values for the execution flow (session size, unlock delay, etc.) |

### 2.2. Requirements

#### 2.2.1. Data Models

**Module**

| Field | Type | Description | Rules |
|-------|------|-------------|-------|
| id | ObjectId | Unique identifier | Auto-generated |
| title | string | Module title | Required |
| theme | string | Thematic topic | Required |
| communicationGoal | string | What the learner can do after completing the module | Required |
| cefrLevel | string | CEFR level of the module | Must be one of: A1, A2, B1, B2, C1, C2 |
| vocabularyItemIds | string[] | Referenced vocabulary items | Must reference existing VocabularyItems |
| grammarConceptIds | string[] | Referenced grammar concepts | Must reference existing GrammarConcepts |
| createdAt | Date | Creation timestamp | Auto-set |
| isUserGenerated | boolean | Whether created on demand for a user | Default: false |
| practiceSessionSize | number | Number of exercises per practice session | Default: 15 |
| testUnlockDelayHours | number | Hours after practice before test unlocks | Default: 4 |
| testRetryDelayMinutes | number | Minutes after a failed test before retry | Default: 20 |
| testFreshExercisePercent | number | % of fresh exercises required in the test | Default: 50 |
| testPassThreshold | number | % correct needed to pass the test | Default: 80 |

#### 2.2.2. Endpoints

- `POST /modules` — insert a module (default or user-generated).
- `GET /modules/:id` — get a module by id (returns ids of vocab/grammar; app resolves via F01/F02).
- `GET /modules` — list modules; optional query params `?cefrLevel=A1` and `?isUserGenerated=false`.

#### 2.2.4. Business Logic

- A dedicated store is the sole DB accessor for the modules collection. Supports: insert, find by id, list by `cefrLevel`, list default modules by level (for dashboard ordering), find user-generated modules by `createdByUserId`.
- On `POST /modules`, the referenced `vocabularyItemIds` and `grammarConceptIds` are validated against the F01 and F02 stores respectively; the request is rejected if any id does not resolve.
- Configurable parameters default to the values in idea §3.1.2 when not provided; each can be overridden per module.

---

## 3. Key Consumer Stories

| # | As a Consumer, I want to… | So that… |
|---|--------------------------|----------|
| CS-01 | Submit a new module with its vocabulary and grammar concept references | the catalog grows as the curriculum is seeded or as users generate custom modules |
| CS-02 | Fetch a module by id | session and test features can resolve module configuration and content references |
| CS-03 | List modules filtered by CEFR level | the app can display the module catalog for the user's current level |

---

## 4. Constraints and Assumptions

- **Constraint** — Modules are inserted by an external tool; this microservice stores and serves them.
- **Constraint** — A default module's vocab/grammar/exercise bank are identical for all users; only progress differs.
- **Constraint** — Configurable parameters default to idea §3.1.2 values but must be overridable per module.
- **Assumption** — The curriculum of default module shells (theme, goal, grammar focus, vocab focus) is human-authored in `default-modules.md` (~123 modules). The external tool realizes those shells into stored modules.

---

## 5. Open Questions

| # | Question | Options / Notes |
|---|----------|-----------------|
| OQ-01 | Should config parameters live on the Module or a separate global config with per-module overrides? | Either; per-module override capability is the requirement |
| OQ-02 | Do we store a module ordering/sequence within a level explicitly, or derive from a code (e.g. A1-01)? | Idea uses codes like A1-01; an explicit order field may be cleaner |
